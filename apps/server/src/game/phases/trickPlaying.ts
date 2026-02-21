import type { GameEngine } from '../engine.js';
import type { Card, Suit } from '@tysiac/shared';
import { hasMarriage, MARRIAGE_VALUES } from '@tysiac/shared';
import { getTrickWinnerWithReason, validateCardPlay, canDeclareMarriage } from '../validation.js';
import { getNextPlayer, isAIPlayer } from '../stateManager.js';
import { detectWykladana } from '../wykladana.js';
import { logDebug } from '../../services/debugService.js';

export function startTrickPlaying(engine: GameEngine): void {
  if (engine.isCleanedUp) return;

  const round = engine.game.currentRound!;

  // Check for WYKLADANA before starting tricks
  const isWykladana = detectWykladana(engine.game);

  if (isWykladana) {
    // Award all 120 trick points to bidder immediately
    const bidderState = round.players[round.bidWinner!];
    bidderState.pointsFromTricks = 120; // All trick points
    bidderState.tricksWon = [[]]; // Mark as having won at least one trick for marriage points
    round.completedTricks = 8;

    // Auto-declare all marriages in bidder's hand
    const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
    for (const suit of suits) {
      if (hasMarriage(bidderState.hand, suit)) {
        bidderState.declaredMarriages.push(suit);
        bidderState.marriagePoints += MARRIAGE_VALUES[suit];
        // Set trump to highest value marriage (first one found in order)
        if (!round.trumpSuit) {
          round.trumpSuit = suit;
        }
      }
    }

    // Emit WYKLADANA celebration event
    const bidWinner = engine.game.players.find(p => p.id === round.bidWinner);
    engine.io.to(engine.roomId).emit('game:wykladana', {
      playerId: round.bidWinner!,
      playerName: bidWinner?.name || 'Unknown',
      bid: round.finalBid,
      marriagePoints: bidderState.marriagePoints,
      cards: bidderState.hand,
    });

    // Set phase to wykladana and wait for all players to confirm
    engine.game.phase = 'wykladana';
    engine.wykladanaConfirmations.clear();

    // Auto-confirm for AI players
    for (const player of engine.game.players) {
      if (player.isAI) {
        engine.wykladanaConfirmations.add(player.id);
      }
    }

    engine.broadcastState();
    engine.checkWykladanaConfirmations();
    return;
  }

  // Normal trick playing setup
  round.currentTrick = {
    cards: [],
    leadSuit: null,
    currentPlayer: round.bidWinner!,
    trickNumber: 1,
  };

  engine.game.phase = 'trickPlaying';
  engine.broadcastState();
  engine.promptCurrentPlayer();
}

export function handleDeclareMarriage(engine: GameEngine, playerId: string, suit: Suit): void {
  if (engine.isCleanedUp) return;
  if (engine.game.phase !== 'trickPlaying') return;

  const round = engine.game.currentRound!;
  const trick = round.currentTrick;

  if (!trick || trick.currentPlayer !== playerId) return;
  if (trick.cards.length !== 0) return; // Must be leading

  const playerState = round.players[playerId];
  const validation = canDeclareMarriage(
    playerState.hand,
    suit,
    playerState.declaredMarriages,
    true
  );

  if (!validation.isValid) {
    engine.sendError(playerId, validation.reason!);
    return;
  }

  // Declare marriage
  playerState.declaredMarriages.push(suit);
  playerState.marriagePoints += MARRIAGE_VALUES[suit];

  // Track marriage for statistics
  const stats = engine.playerStats.get(playerId);
  if (stats) {
    stats.marriageCount++;
  }

  // Set trump
  round.trumpSuit = suit;

  // Emit marriage declared event
  engine.io.to(engine.roomId).emit('game:marriageDeclared', { playerId, suit });

  engine.broadcastState();

  // Auto-play the Queen of the marriage suit
  const queen: Card = { suit, rank: 'Q' };
  handlePlayCard(engine, playerId, queen);
}

export function handlePlayCard(engine: GameEngine, playerId: string, card: Card): void {
  if (engine.isCleanedUp) return;
  if (engine.game.phase !== 'trickPlaying') return;

  const round = engine.game.currentRound!;
  const trick = round.currentTrick;

  if (!trick || trick.currentPlayer !== playerId) return;

  const playerState = round.players[playerId];
  const validation = validateCardPlay(card, playerState.hand, trick, round.trumpSuit, engine.game);

  if (!validation.isValid) {
    engine.sendError(playerId, validation.reason!);
    return;
  }

  // Auto-declare marriage when playing Q while leading
  if (card.rank === 'Q' && trick.cards.length === 0) {
    const suit = card.suit;
    const declared = playerState.declaredMarriages;
    const hasMarriageInSuit = hasMarriage(playerState.hand, suit);

    logDebug({
      gameId: engine.game.id,
      roomId: engine.roomId,
      playerId,
      eventType: 'marriage:check',
      eventData: {
        cardRank: card.rank,
        cardSuit: card.suit,
        trickCardsLength: trick.cards.length,
        hasMarriageResult: hasMarriageInSuit,
        alreadyDeclared: declared,
        handSummary: playerState.hand.map(c => `${c.rank}${c.suit}`),
      },
      result: 'success',
    });

    // Check if player has undeclared marriage in this suit
    if (hasMarriageInSuit && !declared.includes(suit)) {
      // Declare the marriage
      playerState.declaredMarriages.push(suit);
      playerState.marriagePoints += MARRIAGE_VALUES[suit];
      round.trumpSuit = suit;
      // Track marriage for statistics
      const stats = engine.playerStats.get(playerId);
      if (stats) {
        stats.marriageCount++;
      }
      // Emit marriage declared event
      engine.io.to(engine.roomId).emit('game:marriageDeclared', { playerId, suit });
      logDebug({
        gameId: engine.game.id,
        roomId: engine.roomId,
        playerId,
        eventType: 'marriage:declared',
        eventData: { suit, trumpSuit: round.trumpSuit, marriagePoints: playerState.marriagePoints },
        result: 'success',
      });
    }
  }

  // Play card
  trick.cards.push({ playerId, card });
  if (trick.cards.length === 1) {
    trick.leadSuit = card.suit;
  }

  // Remove from hand
  const index = playerState.hand.findIndex(c => c.suit === card.suit && c.rank === card.rank);
  playerState.hand.splice(index, 1);

  engine.io.to(engine.roomId).emit('game:cardPlayed', { playerId, card });

  // Check if trick is complete
  if (trick.cards.length === 3) {
    // Force immediate broadcast so clients see all 3 cards before trick clears.
    // broadcastState() uses queueMicrotask which would fire AFTER completeTrick()
    // resets currentTrick, so clients would never see the 3rd card.
    engine.doBroadcast();
    // Delay trick completion so all 3 cards are visible for ~1s
    engine.safeSetTimeout(() => completeTrick(engine), 1500);
  } else {
    engine.broadcastState();
    // Next player
    trick.currentPlayer = getNextPlayer(engine.game, playerId);
    engine.promptCurrentPlayer();
  }
}

export function completeTrick(engine: GameEngine): void {
  if (engine.isCleanedUp) return;

  const round = engine.game.currentRound!;
  const trick = round.currentTrick!;

  const { winnerId, winningCard, reason } = getTrickWinnerWithReason(trick, round.trumpSuit);

  // Safety check for winner
  if (!winnerId) {
    console.error('Failed to determine trick winner');
    return;
  }

  const trickCards = trick.cards.map(c => c.card);

  // Calculate points
  const points = trickCards.reduce((sum, c) => {
    const cardPoints: Record<string, number> = { '9': 0, 'J': 2, 'Q': 3, 'K': 4, '10': 10, 'A': 11 };
    return sum + cardPoints[c.rank];
  }, 0);

  logDebug({
    gameId: engine.game.id,
    roomId: engine.roomId,
    playerId: winnerId,
    eventType: 'trick:completed',
    eventData: {
      trickNumber: trick.trickNumber,
      cards: trick.cards.map(c => ({ playerId: c.playerId, card: `${c.card.rank}${c.card.suit}` })),
      leadSuit: trick.leadSuit,
      trumpSuit: round.trumpSuit,
      winningCard: `${winningCard.rank}${winningCard.suit}`,
      points,
      reason,
    },
    result: 'success',
  });

  // Award to winner
  round.players[winnerId].tricksWon.push(trickCards);
  round.players[winnerId].pointsFromTricks += points;

  engine.io.to(engine.roomId).emit('game:trickWon', { winnerId, cards: trickCards, points });

  round.completedTricks++;

  // Check if round is complete (8 tricks)
  if (round.completedTricks >= 8) {
    engine.safeSetTimeout(() => engine.endRound(), 1500);
  } else {
    // Start next trick — broadcast immediately since we already
    // waited ~1s in handlePlayCard before calling completeTrick()
    round.currentTrick = {
      cards: [],
      leadSuit: null,
      currentPlayer: winnerId,
      trickNumber: round.completedTricks + 1,
    };

    engine.broadcastState();
    engine.promptCurrentPlayer();
  }
}

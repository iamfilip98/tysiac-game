import type { GameEngine } from '../engine.js';
import type { Card } from '@tysiac/shared';
import type { RoundHistory } from '../statistics.js';
import { isAIPlayer } from '../stateManager.js';
import { logDebug } from '../../services/debugService.js';

export function handleConfirmTalon(engine: GameEngine, playerId: string): void {
  if (engine.isCleanedUp) return;
  if (engine.game.phase !== 'talonReveal') {
    logDebug({
      gameId: engine.game.id,
      roomId: engine.roomId,
      playerId,
      eventType: 'talon:confirm:rejected',
      eventData: { reason: 'wrong_phase', currentPhase: engine.game.phase },
      result: 'rejected',
    });
    return;
  }

  // Add player confirmation
  engine.talonConfirmations.add(playerId);
  logDebug({
    gameId: engine.game.id,
    roomId: engine.roomId,
    playerId,
    eventType: 'talon:confirm',
    eventData: {
      confirmations: Array.from(engine.talonConfirmations),
      totalPlayers: engine.game.players.length,
    },
    result: 'success',
  });
  checkTalonConfirmations(engine);
}

export function checkTalonConfirmations(engine: GameEngine): void {
  if (engine.isCleanedUp) return;

  // Auto-confirm disconnected players (no socket = disconnected)
  for (const player of engine.game.players) {
    if (player.isAI) continue; // AI already auto-confirmed
    const socketId = engine.getSocketId(player.id);
    if (!socketId && !engine.talonConfirmations.has(player.id)) {
      logDebug({
        gameId: engine.game.id,
        roomId: engine.roomId,
        playerId: player.id,
        eventType: 'talon:autoconfirm:disconnected',
        eventData: { reason: 'no_socket' },
        result: 'success',
      });
      engine.talonConfirmations.add(player.id);
    }
  }

  // Check if all players have confirmed
  const playerIds = engine.game.players.map(p => p.id);
  const confirmedIds = Array.from(engine.talonConfirmations);
  const missingConfirmations = playerIds.filter(id => !engine.talonConfirmations.has(id));
  const allConfirmed = missingConfirmations.length === 0;

  logDebug({
    gameId: engine.game.id,
    roomId: engine.roomId,
    eventType: 'talon:checkConfirmations',
    eventData: {
      playerIds,
      confirmedIds,
      missingConfirmations,
      allConfirmed,
    },
    result: allConfirmed ? 'success' : 'rejected',
  });

  if (allConfirmed) {
    const round = engine.game.currentRound!;

    // Bidder always gets the option to play or throw (pass)
    // Give talon to bid winner before the decision so they can see it in their hand
    const bidWinnerId = round.bidWinner!;
    if (!engine.talonAddedToHand) {
      round.players[bidWinnerId].hand.push(...round.talon);
      round.cardsToDistribute = [...round.talon];
      engine.talonAddedToHand = true;
    }

    logDebug({
      gameId: engine.game.id,
      roomId: engine.roomId,
      eventType: 'phase:transition',
      eventData: {
        from: 'talonReveal',
        to: 'playOrPassDecision',
        bidWinner: round.bidWinner,
        finalBid: round.finalBid,
        talonAddedToHand: true,
      },
      result: 'success',
    });
    engine.game.phase = 'playOrPassDecision';
    engine.broadcastState();
    promptPlayOrPassDecision(engine);
  }
}

export function promptPlayOrPassDecision(engine: GameEngine): void {
  if (engine.isCleanedUp) return;

  const round = engine.game.currentRound!;
  const bidWinnerId = round.bidWinner!;

  // Check if AI player - AI evaluates whether to play or pass
  if (isAIPlayer(engine.game, bidWinnerId)) {
    const aiHand = round.players[bidWinnerId].hand;
    const isOnBarrel = engine.game.scores[bidWinnerId]?.isOnBarrel || false;
    const aiDecision = engine.ai.decidePlayOrPass(aiHand, round.finalBid, isOnBarrel);
    logDebug({
      gameId: engine.game.id,
      roomId: engine.roomId,
      playerId: bidWinnerId,
      eventType: 'playOrPass:prompt:ai',
      eventData: { decision: aiDecision, finalBid: round.finalBid, isOnBarrel },
      result: 'success',
    });
    engine.safeSetTimeout(() => {
      engine.handlePlayOrPass(bidWinnerId, aiDecision);
    }, 800);
    return;
  }

  // Notify human player
  const socketId = engine.getSocketId(bidWinnerId);
  logDebug({
    gameId: engine.game.id,
    roomId: engine.roomId,
    playerId: bidWinnerId,
    socketId: socketId || undefined,
    eventType: 'playOrPass:prompt:human',
    eventData: { hasSocket: !!socketId },
    result: socketId ? 'success' : 'error',
    errorMessage: socketId ? undefined : 'No socket found for bid winner',
  });
  if (socketId) {
    engine.io.to(socketId).emit('game:yourTurn', {
      validActions: [{ type: 'playOrPass' }],
    });

    // Public games: auto-pass after 60 seconds if no response
    if (!engine.isPrivateRoom) {
      engine.clearPlayOrPassTimer();
      engine.playOrPassTimer = setTimeout(() => {
        engine.playOrPassTimer = null;
        if (engine.game.phase === 'playOrPassDecision') {
          logDebug({
            gameId: engine.game.id,
            roomId: engine.roomId,
            playerId: bidWinnerId,
            eventType: 'playOrPass:timeout',
            eventData: { timeoutMs: 60000 },
            result: 'success',
          });
          engine.handlePlayOrPass(bidWinnerId, 'pass');
        }
      }, 60000);
      engine.activeTimers.add(engine.playOrPassTimer);
    }
  } else {
    // No socket - player disconnected. Auto-play for them.
    logDebug({
      gameId: engine.game.id,
      roomId: engine.roomId,
      playerId: bidWinnerId,
      eventType: 'playOrPass:autoPlay:disconnected',
      eventData: { reason: 'no_socket' },
      result: 'success',
    });
    engine.safeSetTimeout(() => {
      engine.handlePlayOrPass(bidWinnerId, 'play');
    }, 800);
  }
}

export function handlePlayOrPass(engine: GameEngine, playerId: string, decision: 'play' | 'pass'): void {
  if (engine.isCleanedUp) return;
  if (engine.game.phase !== 'playOrPassDecision') return;

  // Clear the safeguard timer since we're handling the decision
  engine.clearPlayOrPassTimer();

  const round = engine.game.currentRound!;
  if (playerId !== round.bidWinner) return;

  if (decision === 'pass') {
    const player = engine.game.players.find(p => p.id === playerId);
    const bidAmount = round.finalBid;

    if (bidAmount === 100) {
      // At 100: no penalty, just emit passed event
      engine.io.to(engine.roomId).emit('game:playerPassedAt100', {
        playerId,
        playerName: player?.name || 'Unknown',
      });
    } else {
      // At >100: bidder loses bid amount, 120 points distributed to others
      // Deduct bid amount from bidder
      engine.game.scores[playerId].totalScore -= bidAmount;
      engine.game.scores[playerId].roundScores.push(-bidAmount);

      // Get active players (exclude dealer in 4-player mode)
      const activePlayers = round.isDealerSittingOut
        ? engine.game.players.filter(p => p.id !== round.dealer)
        : engine.game.players;

      // Other active players (exclude the bidder)
      const otherActivePlayers = activePlayers.filter(p => p.id !== playerId);
      const pointsPerPlayer = Math.floor(120 / otherActivePlayers.length);

      // Track score changes for the event
      const scoreChanges: Record<string, number> = {};
      scoreChanges[playerId] = -bidAmount;

      // Distribute 120 points evenly to other players (barrel players get 0)
      for (const otherPlayer of otherActivePlayers) {
        const isOnBarrel = engine.game.scores[otherPlayer.id].isOnBarrel;
        const awarded = isOnBarrel ? 0 : pointsPerPlayer;
        engine.game.scores[otherPlayer.id].totalScore += awarded;
        engine.game.scores[otherPlayer.id].roundScores.push(awarded);
        scoreChanges[otherPlayer.id] = awarded;
      }

      // Emit the threw event with score changes
      engine.io.to(engine.roomId).emit('game:playerThrew', {
        playerId,
        playerName: player?.name || 'Unknown',
        bidAmount,
        scoreChanges,
      });

      logDebug({
        gameId: engine.game.id,
        roomId: engine.roomId,
        playerId,
        eventType: 'player:threw',
        eventData: {
          bidAmount,
          scoreChanges,
          newScores: Object.fromEntries(
            Object.entries(engine.game.scores).map(([id, s]) => [id, s.totalScore])
          ),
        },
        result: 'success',
      });
    }

    // Record the passed round in history
    const passedRoundHistory: RoundHistory = {
      roundNumber: round.roundNumber,
      bidWinner: playerId,
      bid: bidAmount,
      bidderMadeBid: false,
      wasPassed: true,
      playerScores: {},
    };
    for (const p of engine.game.players) {
      let scoreChange: number;
      if (p.id === playerId) {
        scoreChange = bidAmount === 100 ? 0 : -bidAmount;
      } else if (bidAmount === 100) {
        scoreChange = 0;
      } else {
        const isOnBarrel = engine.game.scores[p.id].isOnBarrel;
        const otherCount = round.isDealerSittingOut
          ? engine.game.players.filter(pl => pl.id !== round.dealer && pl.id !== playerId).length
          : engine.game.players.filter(pl => pl.id !== playerId).length;
        scoreChange = isOnBarrel ? 0 : Math.floor(120 / otherCount);
      }
      passedRoundHistory.playerScores[p.id] = {
        trickPoints: 0,
        marriagePoints: 0,
        totalRoundPoints: 0,
        scoreChange,
        newTotalScore: engine.game.scores[p.id].totalScore,
        wasOnBarrel: engine.game.scores[p.id].isOnBarrel,
      };
    }
    engine.roundHistory.push(passedRoundHistory);

    // Delay must exceed client notification duration so cards aren't dealt while it's visible
    // Pass at 100: 3s notification + 1.5s pause = 4.5s
    // Threw (>100): 4s notification + 1.5s pause = 5.5s
    const newRoundDelay = bidAmount === 100 ? 4500 : 5500;
    engine.safeSetTimeout(() => {
      engine.startNewRound();
    }, newRoundDelay);
  } else {
    // Player chose to play - proceed to talon distribution
    proceedToTalonDistribution(engine);
  }
}

export function proceedToTalonDistribution(engine: GameEngine): void {
  if (engine.isCleanedUp) return;

  const round = engine.game.currentRound!;
  const bidWinnerId = round.bidWinner!;

  // Only add talon if not already added
  if (!engine.talonAddedToHand) {
    round.players[bidWinnerId].hand.push(...round.talon);
    round.cardsToDistribute = [...round.talon];
    engine.talonAddedToHand = true;
  }

  engine.safeSetTimeout(() => {
    if (engine.isCleanedUp) return;
    engine.game.phase = 'talonDistribution';
    engine.broadcastState();
    engine.promptCurrentPlayer();
  }, 500);
}

export function handleDistributeTalon(engine: GameEngine, playerId: string, distribution: { playerId: string; card: Card }[]): void {
  if (engine.isCleanedUp) return;
  if (engine.game.phase !== 'talonDistribution') return;

  const round = engine.game.currentRound!;
  if (playerId !== round.bidWinner) return;

  // Validate distribution
  if (distribution.length !== 2) {
    engine.sendError(playerId, 'Must give exactly 2 cards');
    return;
  }

  // Get other active players (exclude bidder and sitting-out dealer)
  const otherPlayers = engine.game.players
    .filter(p => p.id !== playerId && !(round.isDealerSittingOut && p.id === round.dealer))
    .map(p => p.id);
  const targetPlayers = distribution.map(d => d.playerId);

  // Validate each target player ID exists, is not the bid winner, and is an active player
  for (const targetId of targetPlayers) {
    if (!engine.game.players.some(p => p.id === targetId)) {
      engine.sendError(playerId, 'Invalid player ID in distribution');
      return;
    }
    if (targetId === playerId) {
      engine.sendError(playerId, 'Cannot give cards to yourself');
      return;
    }
    if (!otherPlayers.includes(targetId)) {
      engine.sendError(playerId, 'Cannot give cards to inactive player');
      return;
    }
  }

  // Each other player must receive exactly 1 card
  if (!otherPlayers.every(p => targetPlayers.filter(t => t === p).length === 1)) {
    engine.sendError(playerId, 'Each opponent must receive exactly 1 card');
    return;
  }

  // Check for duplicate cards in distribution
  const distributedCards = distribution.map(d => `${d.card.suit}-${d.card.rank}`);
  if (new Set(distributedCards).size !== distributedCards.length) {
    engine.sendError(playerId, 'Cannot give the same card twice');
    return;
  }

  const bidderHand = round.players[playerId].hand;

  // Verify cards are in hand
  for (const { card } of distribution) {
    const inHand = bidderHand.some(c => c.suit === card.suit && c.rank === card.rank);
    if (!inHand) {
      engine.sendError(playerId, 'Card not in hand');
      return;
    }
  }

  // Distribute cards
  for (const { playerId: targetId, card } of distribution) {
    // Remove from bidder's hand
    const index = bidderHand.findIndex(c => c.suit === card.suit && c.rank === card.rank);
    bidderHand.splice(index, 1);

    // Add to target's hand
    round.players[targetId].hand.push(card);
  }

  round.cardsToDistribute = [];
  engine.startTrickPlaying();
}

export function handleConfirmWykladana(engine: GameEngine, playerId: string): void {
  if (engine.isCleanedUp) return;
  if (engine.game.phase !== 'wykladana') {
    logDebug({
      gameId: engine.game.id,
      roomId: engine.roomId,
      playerId,
      eventType: 'wykladana:confirm:rejected',
      eventData: { reason: 'wrong_phase', currentPhase: engine.game.phase },
      result: 'rejected',
    });
    return;
  }

  engine.wykladanaConfirmations.add(playerId);
  logDebug({
    gameId: engine.game.id,
    roomId: engine.roomId,
    playerId,
    eventType: 'wykladana:confirm',
    eventData: {
      confirmations: Array.from(engine.wykladanaConfirmations),
      totalPlayers: engine.game.players.length,
    },
    result: 'success',
  });
  checkWykladanaConfirmations(engine);
}

export function checkWykladanaConfirmations(engine: GameEngine): void {
  if (engine.isCleanedUp) return;

  const playerIds = engine.game.players.map(p => p.id);
  const allConfirmed = playerIds.every(id => engine.wykladanaConfirmations.has(id));

  logDebug({
    gameId: engine.game.id,
    roomId: engine.roomId,
    eventType: 'wykladana:checkConfirmations',
    eventData: {
      playerIds,
      confirmedIds: Array.from(engine.wykladanaConfirmations),
      allConfirmed,
    },
    result: allConfirmed ? 'success' : 'rejected',
  });

  if (allConfirmed) {
    // All players acknowledged, end the round
    engine.endRound();
  }
}

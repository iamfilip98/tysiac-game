import type { GameState, ClientGameState, ValidAction, Card, Suit } from '@tysiac/shared';
import { getTotalMarriageValue, hasMarriage, SUITS, countMarriagesInHand } from '@tysiac/shared';
import { getValidCards } from './validation.js';

/**
 * Convert full game state to client-safe state (hides other players' hands)
 */
export function getClientGameState(game: GameState, playerId: string): ClientGameState {
  const round = game.currentRound;

  let myHand: Card[] = [];
  let talon: Card[] | null = null;
  let cardsToDistribute: Card[] | null = null;
  let roundInfo = null;

  if (round) {
    // Get player's hand
    myHand = round.players[playerId]?.hand || [];

    // Talon visibility
    if (game.phase === 'talonReveal' || game.phase === 'talonDistribution') {
      const isBidWinner = round.bidWinner === playerId;
      const won100Hidden = round.finalBid === 100 && isBidWinner;

      // If won at 100, talon is hidden from others
      if (isBidWinner || !won100Hidden) {
        talon = round.talon;
      }
    }

    // Cards to distribute (only visible to bid winner during distribution)
    if (game.phase === 'talonDistribution' && round.bidWinner === playerId) {
      cardsToDistribute = round.cardsToDistribute;
    }

    // Round info
    const playerTrickCounts: Record<string, number> = {};
    const declaredMarriages: Record<string, Suit[]> = {};

    for (const [pid, state] of Object.entries(round.players)) {
      playerTrickCounts[pid] = state.tricksWon.length;
      declaredMarriages[pid] = state.declaredMarriages;
    }

    roundInfo = {
      roundNumber: round.roundNumber,
      dealer: round.dealer,
      trumpSuit: round.trumpSuit,
      bidWinner: round.bidWinner,
      finalBid: round.finalBid,
      currentTrick: round.currentTrick,
      completedTricks: round.completedTricks,
      playerTrickCounts,
      declaredMarriages,
    };
  }

  return {
    id: game.id,
    roomId: game.roomId,
    phase: game.phase,
    players: game.players,
    scores: Object.fromEntries(
      Object.entries(game.scores).map(([id, s]) => [
        id,
        {
          totalScore: s.totalScore,
          roundScores: s.roundScores,
          isOnBarrel: s.isOnBarrel,
        },
      ])
    ),
    round: roundInfo,
    myHand,
    talon,
    cardsToDistribute,
    winner: game.winner,
  };
}

/**
 * Get valid actions for a player
 */
export function getValidActions(
  game: GameState,
  playerId: string,
  biddingState?: {
    currentBidder: string;
    currentBid: number;
    passedPlayers: string[];
  }
): ValidAction[] {
  const actions: ValidAction[] = [];
  const round = game.currentRound;

  if (!round) return actions;

  switch (game.phase) {
    case 'bidding': {
      if (!biddingState || biddingState.currentBidder !== playerId) break;

      const hand = round.players[playerId].hand;
      const marriageValue = getTotalMarriageValue(hand);
      const maxBid = 120 + marriageValue;
      const minBid = biddingState.currentBid === 100 ? 110 : biddingState.currentBid + 10;

      if (minBid <= maxBid) {
        actions.push({ type: 'bid', minBid, maxBid });
      }

      // Can always pass (unless forced)
      const dealerIndex = game.players.findIndex(p => p.id === round.dealer);
      const leftOfDealer = game.players[(dealerIndex + 1) % 3].id;

      // Left of dealer can't pass if others passed (they're forced)
      const othersPassed = biddingState.passedPlayers.length === 2;
      if (!(playerId === leftOfDealer && othersPassed)) {
        actions.push({ type: 'pass' });
      }

      break;
    }

    case 'talonDistribution': {
      if (round.bidWinner !== playerId) break;

      actions.push({ type: 'distributeTalon', cardsToGive: 2 });
      break;
    }

    case 'trickPlaying': {
      const trick = round.currentTrick;
      if (!trick || trick.currentPlayer !== playerId) break;

      const hand = round.players[playerId].hand;
      const isLeading = trick.cards.length === 0;

      // Check for marriage declaration opportunity
      if (isLeading) {
        const declared = round.players[playerId].declaredMarriages;
        const availableMarriages = SUITS.filter(
          suit => hasMarriage(hand, suit) && !declared.includes(suit)
        );

        if (availableMarriages.length > 0) {
          actions.push({ type: 'declareMarriage', suits: availableMarriages });
        }
      }

      // Valid cards to play
      const validCards = getValidCards(hand, trick, round.trumpSuit, game);
      actions.push({ type: 'playCard', validCards });

      break;
    }
  }

  return actions;
}

/**
 * Get the next player in turn order
 */
export function getNextPlayer(game: GameState, currentPlayerId: string): string {
  const currentIndex = game.players.findIndex(p => p.id === currentPlayerId);
  const nextIndex = (currentIndex + 1) % 3;
  return game.players[nextIndex].id;
}

/**
 * Check if a player is an AI
 */
export function isAIPlayer(game: GameState, playerId: string): boolean {
  const player = game.players.find(p => p.id === playerId);
  return player?.isAI || false;
}

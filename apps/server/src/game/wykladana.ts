import type { Card, Suit, GameState } from '@tysiac/shared';
import { RANK_STRENGTH } from '@tysiac/shared';

/**
 * Detect if WYKLADANA condition is met - bidder can mathematically win all 8 tricks.
 * This is checked WITHOUT trump being set (pure card strength comparison at start of tricks).
 *
 * Rules:
 * - Bidder leads every trick (assumption - they have the lead)
 * - Must follow suit if possible
 * - Higher rank wins within same suit
 * - Without trump, off-suit cards cannot beat lead suit cards
 *
 * WYKLADANA means the bidder has such dominant cards that they mathematically
 * win every single trick regardless of how opponents play.
 */
export function detectWykladana(game: GameState): boolean {
  const round = game.currentRound;
  if (!round || !round.bidWinner) return false;

  const bidWinnerId = round.bidWinner;

  // Get all hands after distribution
  const playerHands: Map<string, Card[]> = new Map();

  for (const player of game.players) {
    // Skip sitting-out dealer in 4-player mode
    if (round.isDealerSittingOut && player.id === round.dealer) continue;

    const playerState = round.players[player.id];
    if (!playerState) continue;

    // Copy hands to avoid mutation
    playerHands.set(player.id, [...playerState.hand]);
  }

  const bidderHand = playerHands.get(bidWinnerId);
  if (!bidderHand || bidderHand.length !== 8) return false;

  // Get opponent hands
  const opponentIds = Array.from(playerHands.keys()).filter(id => id !== bidWinnerId);
  if (opponentIds.length !== 2) return false;

  // Simulate 8 tricks with bidder leading
  const simulatedBidderHand = [...bidderHand];
  const simulatedOpponentHands: Map<string, Card[]> = new Map();
  for (const id of opponentIds) {
    simulatedOpponentHands.set(id, [...(playerHands.get(id) || [])]);
  }

  for (let trick = 0; trick < 8; trick++) {
    if (simulatedBidderHand.length === 0) break;

    // Bidder leads with their strongest card
    const bidderCard = findStrongestCard(simulatedBidderHand);
    if (!bidderCard) return false;

    const leadSuit = bidderCard.suit;

    // Check if any opponent can beat this card
    for (const opponentId of opponentIds) {
      const opponentHand = simulatedOpponentHands.get(opponentId) || [];
      if (opponentHand.length === 0) continue;

      // Get cards opponent must play (follow suit if possible)
      const followSuitCards = opponentHand.filter(c => c.suit === leadSuit);
      const playableCards = followSuitCards.length > 0 ? followSuitCards : opponentHand;

      // Check if any playable card can beat bidder's card (no trump scenario)
      for (const card of playableCards) {
        if (canBeatWithoutTrump(card, bidderCard, leadSuit)) {
          return false; // Opponent can beat bidder, not WYKLADANA
        }
      }
    }

    // Bidder wins this trick - remove played cards
    removeCard(simulatedBidderHand, bidderCard);

    // Each opponent plays their lowest card in suit (or any card if can't follow)
    for (const opponentId of opponentIds) {
      const opponentHand = simulatedOpponentHands.get(opponentId) || [];
      if (opponentHand.length === 0) continue;

      const opponentCard = getWeakestPlayableCard(opponentHand, leadSuit);
      if (opponentCard) {
        removeCard(opponentHand, opponentCard);
      }
    }
  }

  // Bidder won all 8 simulated tricks
  console.log('[WYKLADANA] Detected! Bidder can win all tricks with hand:', bidderHand);
  return true;
}

function findStrongestCard(cards: Card[]): Card | null {
  if (cards.length === 0) return null;

  // Find strongest card by rank strength
  return cards.reduce((strongest, card) => {
    if (RANK_STRENGTH[card.rank] > RANK_STRENGTH[strongest.rank]) {
      return card;
    }
    // If same rank, prefer certain suits (arbitrary tiebreaker)
    if (RANK_STRENGTH[card.rank] === RANK_STRENGTH[strongest.rank]) {
      const suitOrder = ['hearts', 'diamonds', 'clubs', 'spades'];
      if (suitOrder.indexOf(card.suit) < suitOrder.indexOf(strongest.suit)) {
        return card;
      }
    }
    return strongest;
  }, cards[0]);
}

function getWeakestPlayableCard(cards: Card[], leadSuit: Suit): Card | null {
  if (cards.length === 0) return null;

  const followSuitCards = cards.filter(c => c.suit === leadSuit);
  const playableCards = followSuitCards.length > 0 ? followSuitCards : cards;

  return playableCards.reduce((weakest, card) => {
    if (RANK_STRENGTH[card.rank] < RANK_STRENGTH[weakest.rank]) {
      return card;
    }
    return weakest;
  }, playableCards[0]);
}

/**
 * Check if a card can beat another card without trump consideration.
 * Only same-suit cards can beat each other.
 */
function canBeatWithoutTrump(card: Card, toBeat: Card, leadSuit: Suit): boolean {
  // Only lead-suit cards can win (off-suit always loses)
  if (card.suit !== leadSuit) return false;

  // If toBeat is off-suit, any lead-suit card beats it
  if (toBeat.suit !== leadSuit) return true;

  // Both are lead-suit - compare rank strength
  return RANK_STRENGTH[card.rank] > RANK_STRENGTH[toBeat.rank];
}

function removeCard(cards: Card[], toRemove: Card): void {
  const index = cards.findIndex(c => c.suit === toRemove.suit && c.rank === toRemove.rank);
  if (index !== -1) {
    cards.splice(index, 1);
  }
}

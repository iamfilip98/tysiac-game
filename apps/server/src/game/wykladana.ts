import type { Card, Suit, GameState } from '@tysiac/shared';

/**
 * Detect if WYKLADANA condition is met - bidder holds consecutive top cards in each suit.
 *
 * Rules:
 * - For WYKLADANA, bidder must have an unbroken sequence from the top in EVERY suit they hold
 * - For each suit, if bidder has any cards, they must start from Ace and be consecutive
 * - Rank order: A, 10, K, Q, J, 9
 * - Example: Having A-10-K in hearts is valid. Having A-K (missing 10) is NOT valid.
 * - This guarantees the bidder can win all tricks since they always have the highest card.
 */
export function detectWykladana(game: GameState): boolean {
  const round = game.currentRound;
  if (!round || !round.bidWinner) return false;

  const bidWinnerId = round.bidWinner;
  const playerState = round.players[bidWinnerId];
  if (!playerState) return false;

  const bidderHand = playerState.hand;
  if (!bidderHand || bidderHand.length !== 8) return false;

  // Rank order from highest to lowest
  const rankOrder = ['A', '10', 'K', 'Q', 'J', '9'];

  // Group cards by suit
  const suitCards: Map<Suit, Card[]> = new Map();
  for (const card of bidderHand) {
    if (!suitCards.has(card.suit)) {
      suitCards.set(card.suit, []);
    }
    suitCards.get(card.suit)!.push(card);
  }

  // For each suit the bidder has, check for consecutive top cards
  for (const [suit, cards] of suitCards) {
    // Sort cards by rank (highest first)
    cards.sort((a, b) => rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank));

    // Check that cards form an unbroken sequence from the top
    for (let i = 0; i < cards.length; i++) {
      if (cards[i].rank !== rankOrder[i]) {
        // Gap in sequence - not WYKLADANA
        return false;
      }
    }
  }

  // Bidder has consecutive top cards in all suits they hold
  console.log('[WYKLADANA] Detected! Bidder has unbroken top sequences in all suits:', bidderHand);
  return true;
}

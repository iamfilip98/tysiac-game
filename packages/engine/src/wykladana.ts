import type { Card, Suit } from './types';
import { hasMarriage } from './cards';
import { RULES } from './rules';

const RANK_ORDER = ['A', '10', 'K', 'Q', 'J', '9'];
const ALL_SUITS: readonly Suit[] = RULES.marriageOrder; // hearts, diamonds, clubs, spades

/**
 * Count consecutive top cards from Ace downward.
 * E.g. [A, 10, K, 9] → 3 (A, 10, K are consecutive; 9 breaks at Q).
 */
function getTopConsecutive(sortedCards: Card[]): number {
  for (let i = 0; i < sortedCards.length; i++) {
    if (sortedCards[i].rank !== RANK_ORDER[i]) return i;
  }
  return sortedCards.length;
}

/**
 * Check if the hand is a wykladana given a specific trump suit.
 *
 * Strategy: lead all trump first (highest→lowest) to exhaust opponent trumps,
 * then lead each off-suit (highest→lowest). A gap card (non-consecutive) wins
 * only if all opponent cards in that suit have already been forced out by
 * earlier top-consecutive leads.
 *
 * For trump suit: top_consecutive >= opponent_trump_count
 *   (ensures all opponent trumps are exhausted; remaining gap trumps win
 *    because opponents can only play off-suit which doesn't beat trump)
 *
 * For each non-trump suit with gap cards: top_consecutive >= opponent_count
 *   (ensures all opponent cards in that suit are exhausted before gap cards
 *    are played; gap cards then win by default since no one can follow suit
 *    and all trump is already gone)
 */
function isWykladanaWithTrump(
  suitCards: Map<Suit, { cards: Card[]; topConsecutive: number }>,
  trumpSuit: Suit | null,
): boolean {
  // Trump must be exhaustable
  if (trumpSuit) {
    const trump = suitCards.get(trumpSuit);
    if (!trump) return false;
    const oppTrumps = 6 - trump.cards.length;
    if (trump.topConsecutive < oppTrumps) return false;
  }

  // Check each non-trump suit
  for (const [suit, { cards, topConsecutive }] of suitCards) {
    if (suit === trumpSuit) continue;

    const opp = 6 - cards.length;
    const gapCards = cards.length - topConsecutive;

    // All cards are top-consecutive → every lead wins
    if (gapCards === 0) continue;

    // Gap cards exist → need to exhaust all opponent cards in this suit first
    if (topConsecutive < opp) return false;
  }

  return true;
}

/**
 * Detect if WYKLADANA condition is met — bidder can guarantee winning ALL 8 tricks.
 *
 * The bidder leads optimally: exhaust all opponent trumps first, then play
 * each off-suit from the top. A hand qualifies if:
 *
 * 1. For the trump suit (best marriage): the number of consecutive top cards
 *    from Ace down is ≥ the number of opponent trumps (6 − own count).
 *    This guarantees every trump lead wins AND opponent trumps are fully
 *    exhausted, so remaining gap trumps also win.
 *
 * 2. For every non-trump suit the bidder holds: if there are any gap cards
 *    (cards below a break in the sequence), the consecutive top count must
 *    be ≥ opponent cards in that suit. This forces out all opponent cards
 *    before the gap card is led. If all cards are consecutive from the top,
 *    every lead automatically wins.
 *
 * Rank order: A, 10, K, Q, J, 9
 *
 * Example: A♦ 10♦ K♦ Q♦  A♠ 10♠ K♠ 9♠  (trump = diamonds)
 *   Diamonds: 4 consecutive (A-10-K-Q), opp = 2 → 4 ≥ 2 ✓
 *   Spades:   3 consecutive (A-10-K), gap card 9♠, opp = 2 → 3 ≥ 2 ✓
 *   → WYKLADANA (lead 4 diamonds, then A♠ 10♠ K♠ exhaust Q♠ J♠, 9♠ wins)
 */
export function detectWykladana(hand: Card[]): boolean {
  if (hand.length !== 8) return false;

  // Group cards by suit and pre-compute stats
  const suitCards = new Map<Suit, { cards: Card[]; topConsecutive: number }>();
  for (const card of hand) {
    if (!suitCards.has(card.suit)) suitCards.set(card.suit, { cards: [], topConsecutive: 0 });
    suitCards.get(card.suit)!.cards.push(card);
  }
  for (const [, entry] of suitCards) {
    entry.cards.sort((a, b) => RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank));
    entry.topConsecutive = getTopConsecutive(entry.cards);
  }

  // Find marriages in hand (possible trump suits); also try no-trump if no marriages
  const marriageSuits = ALL_SUITS.filter(s => hasMarriage(hand, s));
  const trumpOptions: (Suit | null)[] = marriageSuits.length > 0 ? marriageSuits : [null];

  return trumpOptions.some(trumpSuit => isWykladanaWithTrump(suitCards, trumpSuit));
}

/** Trump for a wykładana round: the first marriage found in ♥♦♣♠ order, or null. */
export function wykladanaTrump(hand: Card[]): Suit | null {
  return ALL_SUITS.find(s => hasMarriage(hand, s)) ?? null;
}

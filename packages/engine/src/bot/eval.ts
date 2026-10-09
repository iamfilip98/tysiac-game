import type { Card, PlayerId, Rank, Suit } from '../types';
import { RULES, SUITS } from '../rules';
import { hasMarriage, marriagesInHand, totalMarriageValue } from '../cards';
import { maxBidFor } from '../bidding';

// Port of the original AIPlayer evaluation heuristics (apps/server/src/ai/index.ts).

const PTS = RULES.cardPoints;
const STR = RULES.rankStrength;

export function cardValue(card: Card): number {
  return PTS[card.rank] + STR[card.rank];
}

function has(hand: Card[], suit: Suit, rank: Rank): boolean {
  return hand.some(c => c.suit === suit && c.rank === rank);
}

function suitCounts(hand: Card[]): number[] {
  return SUITS.map(suit => hand.filter(c => c.suit === suit).length);
}

export function evaluateHandStrength(hand: Card[]): number {
  let strength = 0;
  strength += hand.filter(c => c.rank === 'A').length * 0.15;
  strength += hand.filter(c => c.rank === '10').length * 0.1;
  for (const suit of SUITS) if (has(hand, suit, 'A') && has(hand, suit, '10')) strength += 0.1;
  strength += hand.filter(c => c.rank === 'K').length * 0.05;
  strength += marriagesInHand(hand).length * 0.2;
  const counts = suitCounts(hand);
  if (Math.max(...counts) >= 4) strength += 0.1;
  strength += counts.filter(n => n === 0).length * 0.08;
  return Math.min(1, strength);
}

/** Expected round points for a 7-card hand before seeing the talon. */
export function expectedBidPoints(hand: Card[]): number {
  let points = totalMarriageValue(hand);
  for (const card of hand) {
    if (card.rank === 'A') points += 11;
    else if (card.rank === '10') points += has(hand, card.suit, 'A') ? 9 : 4;
    else if (card.rank === 'K') points += 2;
  }
  // Talon estimate: ~10 base, plus ~12% chance of completing each half-marriage.
  const nearMarriages = SUITS.filter(
    suit => !hasMarriage(hand, suit) && (has(hand, suit, 'Q') || has(hand, suit, 'K')),
  );
  let talonEstimate = 10;
  for (const suit of nearMarriages) talonEstimate += RULES.marriageValues[suit] * 0.12;
  return points + talonEstimate;
}

export type BidDecision = { shouldBid: true; amount: number } | { shouldBid: false };

export function decideBid(hand: Card[], currentBid: number, passedCount: number): BidDecision {
  const maxBid = maxBidFor(hand);
  const minBid = currentBid + RULES.bidStep;
  if (minBid > maxBid) return { shouldBid: false };
  const expected = expectedBidPoints(hand);
  const aggression = passedCount > 0 ? 1.15 : 1.0;
  const targetBid = Math.min(Math.floor((expected * aggression) / 10) * 10, maxBid);
  if (targetBid >= minBid) return { shouldBid: true, amount: minBid };
  if (evaluateHandStrength(hand) > 0.7 && minBid <= RULES.maxBidBase) return { shouldBid: true, amount: minBid };
  return { shouldBid: false };
}

/** Expected round points for the 10-card hand (7 + talon) before the hand-out. */
export function postTalonExpectedPoints(hand: Card[]): number {
  let points = totalMarriageValue(hand);
  for (const card of hand) {
    if (card.rank === 'A') points += 11;
    else if (card.rank === '10') points += has(hand, card.suit, 'A') ? 10 : 4;
    else if (card.rank === 'K') points += 2;
    else if (card.rank === 'Q') points += 1;
  }
  for (const suit of marriagesInHand(hand)) {
    const n = hand.filter(c => c.suit === suit).length;
    if (n >= 4) points += 10;
    else if (n >= 3) points += 5;
  }
  points += suitCounts(hand).filter(n => n === 0).length * 8;
  for (const suit of SUITS) if (has(hand, suit, 'A') && has(hand, suit, '10')) points += 5;
  return points;
}

export function decidePlayOrThrow(hand: Card[], bid: number, onBarrel: boolean): 'play' | 'throw' {
  const expected = postTalonExpectedPoints(hand);
  // Throwing at 100 is free; playing and failing costs 100.
  if (bid <= RULES.autoBid) return expected >= 80 ? 'play' : 'throw';
  // On the barrel a throw costs the bid anyway — always play.
  if (onBarrel) return 'play';
  const threshold = bid <= 130 ? 0.8 : bid <= 170 ? 0.85 : 0.9;
  return expected >= bid * threshold ? 'play' : 'throw';
}

/** Higher = more willing to give this card away in the hand-out. */
export function handoutGiveScore(card: Card, hand: Card[]): number {
  if (hasMarriage(hand, card.suit) && (card.rank === 'Q' || card.rank === 'K')) return -100;
  let score = 0;
  const suitLength = hand.filter(c => c.suit === card.suit).length;
  if (suitLength === 1) score += 20; // creates a void
  else if (suitLength === 2) score += 12; // creates a singleton
  else score -= suitLength * 2;
  score -= cardValue(card) * 2;
  if (card.rank === 'A') score -= 15;
  if (card.rank === '10') score += has(hand, card.suit, 'A') ? -10 : 2;
  if (card.rank === 'Q' || card.rank === 'K') score -= 3;
  if (card.rank === '9') score += 8;
  return score;
}

/** Picks the two most expendable cards; the better one goes to the opponent with the lower score. */
export function decideHandout(
  hand: Card[],
  recipients: PlayerId[],
  totals: Record<PlayerId, number>,
): Record<PlayerId, Card> {
  const scored = hand
    .map(card => ({ card, score: handoutGiveScore(card, hand) }))
    .sort((a, b) => b.score - a.score);
  const card1 = scored[0].card;
  const card2 = scored[1].card;
  const [x, y] = recipients;
  const [better, worse] = cardValue(card1) >= cardValue(card2) ? [card1, card2] : [card2, card1];
  const [weaker, stronger] = (totals[x] ?? 0) <= (totals[y] ?? 0) ? [x, y] : [y, x];
  return { [weaker]: { ...better }, [stronger]: { ...worse } };
}

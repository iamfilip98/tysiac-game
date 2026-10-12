import type { Action, Card, PlayerId, Rank, Suit } from '../types';
import type { BidReason, DecisionReason, GiveWhy, HandoutReason } from './reasons';
import { RULES, SUITS } from '../rules';
import { cardEquals, hasMarriage, marriagesInHand, totalMarriageValue } from '../cards';
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

/** Floors to a multiple of 10: the figure the decisions compare and the coach quotes. */
export function floorTen(points: number): number {
  return Math.floor(points / 10) * 10;
}

/** Bid while the estimate is at least this far below the next bid (measured best of −10/0/+10/+20). */
export const BID_MARGIN = -10;
/** Estimate multiplier once someone has passed. */
export const PASSED_BOOST = 1.15;

export function decideBid(hand: Card[], currentBid: number, passedCount: number): { action: Action; reason: BidReason } {
  const max = maxBidFor(hand);
  const next = currentBid + RULES.bidStep;
  if (next > max) return { action: { type: 'pass' }, reason: { code: 'pass.overMax', next, max } };
  const boosted = passedCount > 0;
  const worth = floorTen(expectedBidPoints(hand) * (boosted ? PASSED_BOOST : 1));
  if (worth < next + BID_MARGIN) return { action: { type: 'pass' }, reason: { code: 'pass.worth', next, worth, boosted } };
  return { action: { type: 'bid', amount: next }, reason: { code: worth >= next ? 'bid.worth' : 'bid.close', next, worth, boosted } };
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

/** At 100 (a free throw) play only with at least this estimate. */
export const PLAY_AT_100 = 80;

/**
 * Above 100 the bot always plays: a throw costs the bid exactly like a failed round, and also pays each
 * opponent their share of the throw pool, while playing keeps a chance of making it.
 */
export function decidePlayOrThrow(hand: Card[], bid: number): { action: Action; reason: DecisionReason } {
  const est = floorTen(postTalonExpectedPoints(hand));
  const play = { type: 'play' } as const;
  if (est >= bid) return { action: play, reason: { code: 'play.enough', est, bid } };
  if (bid <= RULES.autoBid) {
    return est >= PLAY_AT_100
      ? { action: play, reason: { code: 'play.close', est, bid } }
      : { action: { type: 'throw' }, reason: { code: 'throw.free', est, bid } };
  }
  return { action: play, reason: { code: 'play.noThrow', est, bid, share: Math.floor(RULES.throwPool / 2) } };
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
  // A lone K or Q can complete an opponent's marriage; a 10 or A hands them points.
  if (card.rank === 'Q' || card.rank === 'K') score -= 25;
  if (card.rank === '10' || card.rank === 'A') score -= 25;
  return score;
}

function giveWhy(card: Card, after: Card[]): GiveWhy {
  if (!after.some(c => c.suit === card.suit)) return 'void';
  if (PTS[card.rank] === 0) return 'zero';
  return card.rank === 'J' ? 'low' : 'forced';
}

/**
 * Picks the two most expendable cards; the better one goes to the opponent with the lower score.
 * `fixed`: cards the player has already assigned (the coach then recommends only the rest).
 */
export function decideHandout(
  hand: Card[],
  recipients: PlayerId[],
  totals: Record<PlayerId, number>,
  fixed: Partial<Record<PlayerId, Card>> = {},
): { action: Action; reason: HandoutReason } {
  const done = recipients.filter(p => fixed[p] && hand.some(h => cardEquals(h, fixed[p]!)));
  const open = recipients.filter(p => !done.includes(p));
  const taken = done.map(p => fixed[p]!);
  const ranked = hand
    .filter(card => !taken.some(t => cardEquals(t, card)))
    .map(card => ({ card, score: handoutGiveScore(card, hand) }))
    .sort((a, b) => b.score - a.score)
    .map(x => x.card);
  const to: Record<PlayerId, Card> = {};
  let betterTo: PlayerId | null = null;
  if (open.length === 2) {
    const [card1, card2] = ranked;
    const [x, y] = open;
    const [better, worse] = cardValue(card1) >= cardValue(card2) ? [card1, card2] : [card2, card1];
    const [weaker, stronger] = (totals[x] ?? 0) <= (totals[y] ?? 0) ? [x, y] : [y, x];
    to[weaker] = { ...better };
    to[stronger] = { ...worse };
    if ((totals[x] ?? 0) !== (totals[y] ?? 0)) betterTo = weaker;
  } else {
    open.forEach((p, i) => (to[p] = { ...ranked[i] }));
  }
  const gives = Object.entries(to);
  const all = [...taken, ...gives.map(([, card]) => card)];
  const after = hand.filter(h => !all.some(g => cardEquals(g, h)));
  for (const p of done) to[p] = { ...fixed[p]! };
  return {
    action: { type: 'handout', to },
    reason: { code: 'handout', gives: gives.map(([p, card]) => ({ to: p, card, why: giveWhy(card, after) })), betterTo },
  };
}

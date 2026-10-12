import type { Card, GameEventBody, PlayerId, RoundScoreResult, RoundSummary, Suit } from './types';
import { RULES } from './rules';
import { activeFor, dealCards, dealerIndexFor } from './deal';
import { handPoints } from './cards';
import { applyScoreResult, scoreRound, summarizeRound, talonBonus } from './scoring';
import { clone, emit, roundOf, seatIds, sittingOutOf, totalsOf, type Ctx } from './ctx';

/** Deals round `number` and opens bidding: first active player holds 100, the next one bids. */
export function startRound(ctx: Ctx, number: number): void {
  const s = ctx.s;
  const ids = seatIds(s);
  const dealerIndex = dealerIndexFor(s.firstDealer, number, ids.length);
  const dealer = ids[dealerIndex];
  const active = activeFor(ids, dealerIndex);
  const deal = dealCards(s.rng, active);
  s.rng = deal.rng;
  const perActive = <T>(f: () => T): Record<PlayerId, T> => Object.fromEntries(active.map(p => [p, f()]));
  s.round = {
    number,
    dealer,
    active,
    hands: deal.hands,
    talon: deal.talon,
    talonPublic: false,
    talonSeen: [],
    bid: { high: active[0], amount: RULES.autoBid, turn: active[1], passed: [] },
    trump: null,
    marriages: perActive<Suit[]>(() => []),
    trick: { leader: active[0], cards: [] },
    tricksWon: perActive<Card[][]>(() => []),
    handoutGiven: null,
    lastTrick: null,
  };
  s.phase = 'bidding';
  for (const id of ids) {
    emit(ctx, { type: 'dealt', round: number, dealer, active: [...active], hand: clone(deal.hands[id] ?? []) }, [id]);
  }
}

/** Applies a round result, records it, emits `event`, then ends the game or deals the next round. */
export function concludeRound(
  ctx: Ctx,
  result: RoundScoreResult,
  summary: RoundSummary,
  event: GameEventBody,
): void {
  const s = ctx.s;
  s.scores = applyScoreResult(s.scores, result);
  s.rounds.push(summary);
  // Clone the summary so emitted events never alias the entries of state.rounds.
  const withOwnSummary =
    event.type === 'roundScored' || event.type === 'threw' ? { ...event, summary: clone(event.summary) } : event;
  emit(ctx, withOwnSummary);
  if (result.winner) {
    s.phase = 'gameEnd';
    s.winner = result.winner;
    emit(ctx, { type: 'gameWon', p: result.winner, totals: totalsOf(s) });
    return;
  }
  startRound(ctx, summary.number + 1);
}

/** Scores a finished (or wykładana) round, then concludes it. */
export function finishRound(ctx: Ctx, wykladana: boolean): void {
  const s = ctx.s;
  const r = roundOf(ctx);
  const bidder = r.bid.high;
  const trickPoints: Record<PlayerId, number> = {};
  const tricksTaken: Record<PlayerId, number> = {};
  const declared: Record<PlayerId, number> = {};
  for (const p of r.active) {
    trickPoints[p] = r.tricksWon[p].reduce((sum, t) => sum + handPoints(t), 0);
    tricksTaken[p] = r.tricksWon[p].length;
    declared[p] = r.marriages[p].reduce((sum, suit) => sum + RULES.marriageValues[suit], 0);
  }
  if (wykladana) {
    trickPoints[bidder] = RULES.pointsPerRound;
    tricksTaken[bidder] = RULES.tricksPerRound;
  }
  const result = scoreRound({
    order: seatIds(s),
    bidder,
    bid: r.bid.amount,
    dealer: r.dealer,
    sittingOut: sittingOutOf(s),
    totals: totalsOf(s),
    trickPoints,
    tricksTaken,
    declaredMarriagePoints: declared,
    talonBonus: talonBonus(r.talon),
  });
  const summary = summarizeRound(
    {
      number: r.number,
      dealer: r.dealer,
      bidder,
      bid: r.bid.amount,
      outcome: result.bidderMadeBid ? 'made' : 'failed',
      wykladana,
    },
    result,
  );
  concludeRound(ctx, result, summary, { type: 'roundScored', summary });
}

import type { Card, GameEventBody, PlayerId, RoundScoreResult, RoundSummary, Suit } from './types';
import { RULES } from './rules';
import { activeFor, dealCards, dealerIndexFor } from './deal';
import { applyScoreResult } from './scoring';
import { clone, emit, seatIds, totalsOf, type Ctx } from './ctx';

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
  emit(ctx, event);
  if (result.winner) {
    s.phase = 'gameEnd';
    s.winner = result.winner;
    emit(ctx, { type: 'gameWon', p: result.winner, totals: totalsOf(s) });
    return;
  }
  startRound(ctx, summary.number + 1);
}

import type { PlayerId } from '../types';
import { scoreThrow, summarizeRound } from '../scoring';
import { roundOf, seatIds, sittingOutOf, totalsOf, type Ctx } from '../ctx';
import { concludeRound } from '../round';

export function applyPlay(ctx: Ctx): void {
  ctx.s.phase = 'handout';
}

/** Throw in: free at 100; above 100 the bidder pays the bid and the others get 60 each (0 on the barrel). */
export function applyThrow(ctx: Ctx, p: PlayerId): void {
  const s = ctx.s;
  const r = roundOf(ctx);
  const result = scoreThrow({
    order: seatIds(s),
    dealer: r.dealer,
    bidder: p,
    bid: r.bid.amount,
    sittingOut: sittingOutOf(s),
    totals: totalsOf(s),
  });
  const summary = summarizeRound(
    { number: r.number, dealer: r.dealer, bidder: p, bid: r.bid.amount, outcome: 'thrown', wykladana: false },
    result,
  );
  concludeRound(ctx, result, summary, { type: 'threw', p, amount: r.bid.amount, summary });
}

import type { PlayerId } from '../types';
import { RULES } from '../rules';
import { nextBidder } from '../bidding';
import { clone, emit, roundOf, type Ctx } from '../ctx';

export function applyBid(ctx: Ctx, p: PlayerId, amount: number): void {
  const r = roundOf(ctx);
  r.bid.high = p;
  r.bid.amount = amount;
  emit(ctx, { type: 'bid', p, amount });
  advance(ctx, p);
}

export function applyPass(ctx: Ctx, p: PlayerId): void {
  const r = roundOf(ctx);
  r.bid.passed.push(p);
  emit(ctx, { type: 'passed', p });
  advance(ctx, p);
}

function advance(ctx: Ctx, current: PlayerId): void {
  const r = roundOf(ctx);
  const next = r.bid.passed.length >= 2 ? null : nextBidder(r.active, current, r.bid.high, r.bid.passed);
  if (next) {
    r.bid.turn = next;
    return;
  }
  endBidding(ctx);
}

/** Bidding over: the talon goes into the winner's hand; everyone sees it only if the bid is > 100. */
function endBidding(ctx: Ctx): void {
  const r = roundOf(ctx);
  const high = r.bid.high;
  r.bid.turn = null;
  r.talonPublic = r.bid.amount > RULES.autoBid;
  r.talonSeen = [];
  r.hands[high] = [...r.hands[high], ...clone(r.talon)];
  ctx.s.phase = r.talonPublic ? 'talon' : 'decision';
  emit(ctx, { type: 'biddingWon', p: high, amount: r.bid.amount, talonPublic: r.talonPublic });
  emit(ctx, { type: 'talonRevealed', p: high, cards: clone(r.talon) }, r.talonPublic ? 'all' : [high]);
}

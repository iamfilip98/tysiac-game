import type { PlayerId } from '../types';
import { emit, roundOf, type Ctx } from '../ctx';
import { talonWaiting } from '../actions';

/** A seat confirms it has seen the public talon; the last confirmation hands the turn to the bidder. */
export function applyAckTalon(ctx: Ctx, p: PlayerId): void {
  const r = roundOf(ctx);
  r.talonSeen = [...(r.talonSeen ?? []), p];
  emit(ctx, { type: 'talonSeen', p });
  if (talonWaiting(ctx.s).length === 0) ctx.s.phase = 'decision';
}

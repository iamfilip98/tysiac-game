import type { PlayerId } from '@tysiac/engine';

export type Spot = 'me' | 'left' | 'top' | 'right';

/** Screen position of every seat, clockwise from the viewer at the bottom. */
export function spotsFor(seatIds: readonly PlayerId[], me: PlayerId): Record<PlayerId, Spot> {
  const order: Spot[] = seatIds.length === 4 ? ['me', 'left', 'top', 'right'] : ['me', 'left', 'right'];
  const start = Math.max(0, seatIds.indexOf(me));
  const out: Record<PlayerId, Spot> = {};
  for (let k = 0; k < seatIds.length; k++) out[seatIds[(start + k) % seatIds.length]] = order[k];
  return out;
}

export function opponentIds(seatIds: readonly PlayerId[], me: PlayerId): PlayerId[] {
  const start = Math.max(0, seatIds.indexOf(me));
  return Array.from({ length: seatIds.length - 1 }, (_, k) => seatIds[(start + k + 1) % seatIds.length]);
}

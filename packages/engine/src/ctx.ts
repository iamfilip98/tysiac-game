import type { Audience, GameEvent, GameEventBody, GameState, PlayerId, Round } from './types';

/** Mutable context for one reduce call: a private deep copy of the state plus collected events. */
export interface Ctx {
  s: GameState;
  events: GameEvent[];
  now: number;
}

/** Deep copy of JSON data (GameState is JSON-only by design). */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function emit(ctx: Ctx, body: GameEventBody, audience: Audience = 'all'): void {
  ctx.events.push({ ...body, audience } as GameEvent);
}

export function roundOf(ctx: Ctx): Round {
  const r = ctx.s.round;
  if (!r) throw new Error('No round in progress');
  return r;
}

export function seatIds(s: GameState): PlayerId[] {
  return s.seats.map(x => x.id);
}

export function sittingOutOf(s: GameState): PlayerId | null {
  return s.seats.length === 4 && s.round ? s.round.dealer : null;
}

export function totalsOf(s: GameState): Record<PlayerId, number> {
  return Object.fromEntries(Object.entries(s.scores).map(([id, sc]) => [id, sc.total]));
}

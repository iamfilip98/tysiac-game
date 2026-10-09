import type { GameState, Seat } from './types';
import { seedState } from './rng';
import { startRound } from './round';

export interface CreateGameOptions {
  seed: string;
  /** Seats in clockwise order (chosen in the lobby). */
  seats: Seat[];
  maxPlayers: 3 | 4;
  /** Seat index of the round-1 dealer. */
  firstDealer: number;
}

/**
 * Creates a game and deals round 1. Throws on invalid options (a room-level programming error).
 * Round-1 hands reach players via `viewFor`, not a `dealt` event (startRound events are discarded).
 */
export function createGame(opts: CreateGameOptions): GameState {
  const { seats, maxPlayers, firstDealer } = opts;
  if (maxPlayers !== 3 && maxPlayers !== 4) throw new Error('maxPlayers must be 3 or 4');
  if (seats.length !== maxPlayers) throw new Error(`Expected ${maxPlayers} seats, got ${seats.length}`);
  const ids = seats.map(x => x.id);
  if (new Set(ids).size !== ids.length) throw new Error('Seat ids must be unique');
  if (!Number.isInteger(firstDealer) || firstDealer < 0 || firstDealer >= maxPlayers) {
    throw new Error('firstDealer must be a seat index');
  }
  const s: GameState = {
    v: 1,
    seq: 0,
    rng: seedState(opts.seed),
    seats: seats.map(x => ({ ...x })),
    firstDealer,
    maxPlayers,
    phase: 'bidding',
    round: null,
    scores: Object.fromEntries(ids.map(id => [id, { total: 0, history: [] }])),
    rounds: [],
    paused: null,
    winner: null,
  };
  startRound({ s, events: [], now: 0 }, 1);
  return s;
}

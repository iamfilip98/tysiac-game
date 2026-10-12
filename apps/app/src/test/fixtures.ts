import {
  botAction, createGame, eventsFor, makeRandom, reduce, actorsOf, viewFor,
  type Action, type GameEvent, type GameState, type PlayerId, type PlayerView, type Seat,
} from '@tysiac/engine';
import type { RoomInfo, RoomSeat, ServerMessage } from '../net/protocol';

export const SEATS: Seat[] = [
  { id: 'me', name: 'Filip', avatar: '🦊', isBot: false },
  { id: 'b', name: 'Bot Basia', avatar: '🤖', isBot: true },
  { id: 'z', name: 'Bot Zenek', avatar: '🤖', isBot: true },
];
export const SEATS4: Seat[] = [...SEATS, { id: 'h', name: 'Bot Halina', avatar: '🤖', isBot: true }];

export interface Stepped {
  state: GameState;
  events: GameEvent[];
}

export function step(state: GameState, p: PlayerId, action: Action): Stepped {
  const r = reduce(state, p, action, 0);
  if (!r.ok) throw new Error(`fixture: ${p} ${JSON.stringify(action)} rejected: ${r.error.message}`);
  return { state: r.state, events: r.events };
}

export function botStep(state: GameState, rng: () => number = () => 0.5): Stepped {
  const p = actorsOf(state)[0];
  if (!p) throw new Error('fixture: nobody to act');
  return step(state, p, botAction(viewFor(state, p), rng));
}

/** Plays bot moves for every seat (including `me`) from fresh games fx-0…fx-299 until `until` holds. */
export function findState(until: (s: GameState) => boolean, seats: Seat[] = SEATS, maxActions = 300): GameState {
  for (let i = 0; i < 300; i++) {
    let s = createGame({ seed: `fx-${i}`, seats, maxPlayers: seats.length as 3 | 4, firstDealer: 0 });
    const rng = makeRandom(`fx-${i}`);
    for (let n = 0; n < maxActions && s.phase !== 'gameEnd'; n++) {
      if (until(s)) return s;
      s = botStep(s, rng).state;
    }
    if (until(s)) return s;
  }
  throw new Error('findState: no seed reached the condition');
}

export const viewOf = (s: GameState, p: PlayerId = 'me'): PlayerView => viewFor(s, p);

export function stateMsg(s: GameState, events: GameEvent[] = [], p: PlayerId = 'me'): Extract<ServerMessage, { t: 'state' }> {
  return { t: 'state', seq: s.seq, view: viewFor(s, p), events: eventsFor(events, p) };
}

export function roomInfo(over: Partial<RoomInfo> = {}, seats: Seat[] = SEATS): RoomInfo {
  return {
    code: 'ABCDEF',
    status: 'playing',
    maxPlayers: seats.length as 3 | 4,
    hostId: 'me',
    firstDealer: 0,
    seats: seats.map((s): RoomSeat => ({ id: s.id, name: s.name, avatar: s.avatar, isBot: s.isBot, connected: true, awaySince: null, botFor: false, coach: false })),
    ...over,
  };
}

export const welcomeMsg = (room: RoomInfo = roomInfo()): ServerMessage => ({ t: 'welcome', you: 'me', room, serverTime: 0 });

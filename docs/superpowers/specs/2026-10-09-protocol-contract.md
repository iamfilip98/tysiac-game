# Protocol contract (`packages/protocol`)

Binding contract between `apps/worker` (milestone 2) and `apps/app` (milestone 3). Refines spec §5.
Milestone 2 creates `packages/protocol` (name `@tysiac/protocol`, deps: `@tysiac/engine` workspace, `zod`)
with `src/index.ts` containing exactly these exports (zod schemas may be added alongside; names below are fixed).
Engine types (`Action`, `PlayerView`, `GameEvent`, `PlayerId`, `Card`) come from `@tysiac/engine`
(see docs/superpowers/plans/2026-10-09-m1-engine.md Task 1 `src/types.ts`).

```ts
import type { Action, GameEvent, PlayerId, PlayerView } from '@tysiac/engine';

export const PROTOCOL_VERSION = 2;

// ---------- HTTP ----------
// POST /api/rooms            body CreateRoomRequest → CreateRoomResponse | { error: string }
export interface CreateRoomRequest { maxPlayers: 3 | 4; playerId: PlayerId; name: string; avatar: string }
export interface CreateRoomResponse { code: string }
// GET /api/rooms/:code       → RoomExistsResponse   (used by the app before opening a socket)
export interface RoomExistsResponse { exists: boolean; status?: RoomStatus; maxPlayers?: 3 | 4; seatsTaken?: number }
// GET /api/history?player=<id> → HistoryResponse
export interface HistoryGame {
  id: string; finishedAt: number; playerCount: 3 | 4; winnerId: PlayerId;
  players: { id: PlayerId; name: string; avatar: string; isBot: boolean; finalScore: number; won: boolean }[];
}
export interface HeadToHead { opponentId: PlayerId; name: string; avatar: string; games: number; wins: number; losses: number }
export interface LeaderboardRow { playerId: PlayerId; name: string; avatar: string; games: number; wins: number }
export interface HistoryResponse { games: HistoryGame[]; headToHead: HeadToHead[]; leaderboard: LeaderboardRow[] }
// WebSocket: GET /ws/:code (Upgrade: websocket). Max message 4 KB, ≤ 20 msgs/s per socket.

// ---------- client → server ----------
export type ClientMessage =
  | { t: 'hello'; v: typeof PROTOCOL_VERSION; playerId: PlayerId; secret: string; name: string; avatar: string; coach: boolean }
  | { t: 'act'; id: string; action: Action }
  | { t: 'lobby'; op: LobbyOp }
  | { t: 'botFor'; playerId: PlayerId }     // allowed when that seat has been away ≥ 30 s
  | { t: 'setCoach'; coach: boolean }
  | { t: 'rematch' }                         // host only, when status === 'finished'
  | { t: 'leave' }                           // lobby only: frees your seat
  | { t: 'ping' };

export type LobbyOp =
  | { op: 'addBot' }                                 // host
  | { op: 'removeBot'; playerId: PlayerId }          // host
  | { op: 'swapSeats'; a: number; b: number }        // anyone (seat indices, clockwise)
  | { op: 'setFirstDealer'; seat: number }           // host
  | { op: 'start' };                                 // host, all seats filled

// ---------- server → client ----------
export type RoomStatus = 'lobby' | 'playing' | 'finished';

export interface RoomSeat {
  id: PlayerId; name: string; avatar: string; isBot: boolean;
  connected: boolean;           // bots: always true
  awaySince: number | null;     // ms epoch when disconnected during a game
  botFor: boolean;              // a bot is currently playing for this human
  coach: boolean;               // shows 🎓
}

export interface RoomInfo {
  code: string; status: RoomStatus; maxPlayers: 3 | 4; hostId: PlayerId;
  seats: (RoomSeat | null)[];   // length = maxPlayers, clockwise; null = empty seat (lobby only)
  firstDealer: number;
}

export type ServerMessage =
  | { t: 'welcome'; you: PlayerId; room: RoomInfo; serverTime: number }
  | { t: 'room'; room: RoomInfo }
  | { t: 'state'; seq: number; view: PlayerView; events: GameEvent[] }   // events already filtered for this player
  | { t: 'ack'; id: string }
  | { t: 'reject'; id: string; code: string; message: string; msg?: EngineMsg }   // msg: structured engine reason { key, params }
  | { t: 'error'; code: ErrorCode; message: string }
  | { t: 'pong' };

export type ErrorCode = 'badMessage' | 'roomFull' | 'badSecret' | 'notHost' | 'notInRoom' | 'rateLimited' | 'gameInProgress' | 'versionMismatch';
```

Behaviour notes:
- First message on a socket must be `hello`; anything else → `error badMessage` and close. On success the server replies `welcome`, and if a game exists, `state` with `events: []`.
- After every accepted engine action the server sends each connected human `state` (personalised view + filtered events), and `ack` to the sender. Illegal → `reject` to the sender only. For engine rejections `message` is the stable message key (for logs) and `msg` is the structured `EngineMsg` the app renders in the player's language; other rejections (`notPlaying`, …) have no `msg` and the app maps the `code`.
- `room` is broadcast on any lobby/seat/connection change.
- **Talon confirmation (v2).** When a bid above 100 wins, the phase becomes `talon`: `view.turn` is `null`, `view.round.talonWaiting` lists the seats that still have to send `{ type: 'ackTalon' }` (everyone but the bidder, including a 4-player sitting-out dealer), and each confirmation emits `{ type: 'talonSeen', p }` to all. The last one moves the game to `decision`. Bots and bot-for seats confirm through the normal bot alarm. Engine phases are now `bidding | talon | decision | handout | tricks | gameEnd`; `Action` gained `{ type: 'ackTalon' }`.
- Bots in the engine `Seat` have `isBot: true`; a human seat with an active bot-for has engine `Seat.botFor` = `'bot'`.
- Close codes (exported from `@tysiac/protocol`): `CLOSE_REPLACED = 4000` = replaced by another connection of the same player; `CLOSE_PROTOCOL = 1008` = protocol violation or refused hello (preceded by an `error`). The client MUST NOT reconnect after either. An `error` with `versionMismatch` or `badSecret` is also terminal. (1000 = left, 1001 = room expired.)
- Client keeps `playerId`/`secret` in localStorage (`tysiac.identity`), reconnects with backoff 0.5 s → 5 s and re-sends `hello`.

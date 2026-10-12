import type { Action, EngineMsg, GameEvent, PlayerId, PlayerView } from '@tysiac/engine';

export const PROTOCOL_VERSION = 2;

/** WebSocket close code: another connection of the same player replaced this one. Do not reconnect. */
export const CLOSE_REPLACED = 4000;
/** WebSocket close code: protocol violation or refused hello. Do not reconnect. */
export const CLOSE_PROTOCOL = 1008;

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
  /** `message` is a stable key for logs; `msg` (engine rejections) is what the app translates and shows. */
  | { t: 'reject'; id: string; code: string; message: string; msg?: EngineMsg }
  | { t: 'error'; code: ErrorCode; message: string }
  | { t: 'pong' };

export type ErrorCode = 'badMessage' | 'roomFull' | 'badSecret' | 'notHost' | 'notInRoom' | 'rateLimited' | 'gameInProgress' | 'versionMismatch';

export * from './schemas';

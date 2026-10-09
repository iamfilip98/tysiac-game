import type { Action, CreateGameOptions, GameState, PlayerId } from '@tysiac/engine';
import type { RoomStatus } from '@tysiac/protocol';
import type { Schedule } from '../scheduler';

export interface SeatMeta {
  id: PlayerId;
  name: string;
  avatar: string;
  isBot: boolean;
  /** Hex sha256 of the device secret. Null for bots, and for the host's reserved seat until its first hello. */
  secretHash: string | null;
  /** Set when a human's last socket closes during a game; cleared on reconnect. */
  awaySince: number | null;
  /** A bot is playing for this (away) human. */
  botFor: boolean;
  coach: boolean;
}

export interface RoomMeta {
  code: string;
  maxPlayers: 3 | 4;
  hostId: PlayerId;
  status: RoomStatus;
  createdAt: number;
  /** Clockwise. Length = maxPlayers; null = empty seat (lobby only). */
  seats: (SeatMeta | null)[];
  firstDealer: number;
  gameId: string | null;
  startedAt: number | null;
}

/** Exactly what createGame received: seed + seats + first dealer → deterministic replay with the log. */
export type GameOptions = CreateGameOptions;

export interface LogEntry {
  seq: number;
  at: number;
  player: PlayerId;
  action: Action;
}

/** Stored on each hibernatable socket; survives hibernation and eviction. */
export interface SocketAttachment {
  playerId: PlayerId | null;
}

export interface InitRoomRequest {
  code: string;
  maxPlayers: 3 | 4;
  hostId: PlayerId;
  name: string;
  avatar: string;
  now: number;
}

export type PublicSeatMeta = Omit<SeatMeta, 'secretHash'>;

export interface DebugDump {
  meta: Omit<RoomMeta, 'seats'> & { seats: (PublicSeatMeta | null)[] };
  state: GameState | null;
  gameOptions: GameOptions | null;
  log: LogEntry[];
  schedule: Schedule;
  connected: PlayerId[];
}

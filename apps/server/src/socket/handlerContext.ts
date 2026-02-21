import { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@tysiac/shared';
import { GameEngine } from '../game/engine.js';

export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

export interface HandlerContext {
  io: TypedServer;
  socketToPlayer: Map<string, string>;
  playerToSocket: Map<string, string>;
  gameEngines: Map<string, GameEngine>;
  gameCreationLocks: Set<string>;
  disconnectTimeouts: Map<string, NodeJS.Timeout>;
  socketToIP: Map<string, string>;
  authenticatedPlayerId: string | null;
  DISCONNECT_GRACE_PERIOD: number;
  ROOM_GRACE_PERIOD: number;
  logEvent(params: {
    socketId: string;
    eventType: string;
    eventData?: unknown;
    result?: 'success' | 'error' | 'rejected';
    errorMessage?: string;
    metadata?: unknown;
  }): void;
  cleanupGame(gameId: string, roomId: string): void;
  broadcastRoomList(): void;
  handlePlayerLeave(socket: TypedSocket, immediate: boolean): void;
  withRateLimit<T>(socket: TypedSocket, eventName: string, handler: () => T): T | undefined;
}

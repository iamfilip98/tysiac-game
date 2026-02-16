import type { ClientToServerEvents, ServerToClientEvents } from '@tysiac/shared';
import * as roomService from '../services/roomService.js';
import * as gameService from '../services/gameService.js';
import * as debugService from '../services/debugService.js';
import { GameEngine } from '../game/engine.js';
import { checkRateLimit, trackIPConnection } from '../security/rateLimit.js';
import { invalidatePlayerSession } from '../security/session.js';
import { removePersistedGame } from '../services/persistenceService.js';
import { registerRoomHandlers } from './roomHandlers.js';
import { registerGameHandlers } from './gameHandlers.js';
import { registerConnectionHandlers } from './connectionHandlers.js';
import type { HandlerContext, TypedSocket, TypedServer } from './handlerContext.js';

// Module-level state
const socketToPlayer = new Map<string, string>();
const playerToSocket = new Map<string, string>();
const gameEngines = new Map<string, GameEngine>();
const gameCreationLocks = new Set<string>();
const disconnectTimeouts = new Map<string, NodeJS.Timeout>();
const DISCONNECT_GRACE_PERIOD = 300000; // 5 minutes for in-game (matches pre-game)
const ROOM_GRACE_PERIOD = 300000; // 5 minutes for pre-game rooms
const socketToIP = new Map<string, string>();

// Helper to log debug events with full context (wrapped in try-catch to never break game flow)
function logEvent(params: {
  socketId: string;
  eventType: string;
  eventData?: unknown;
  result?: 'success' | 'error' | 'rejected';
  errorMessage?: string;
  metadata?: unknown;
}): void {
  try {
    const playerId = socketToPlayer.get(params.socketId) || null;
    const room = playerId ? roomService.getRoomByPlayerId(playerId) : null;
    const game = room?.gameId ? gameService.getGame(room.gameId) : null;

    debugService.logDebug({
      gameId: room?.gameId || null,
      roomId: room?.id || null,
      playerId,
      socketId: params.socketId,
      eventType: params.eventType,
      eventData: params.eventData,
      gameState: game || null,
      result: params.result,
      errorMessage: params.errorMessage,
      metadata: {
        ...(params.metadata as object || {}),
        playerName: room?.players.find(p => p.id === playerId)?.name,
        roomCode: room?.code,
        roomPlayerCount: room?.players.length,
      },
    });
  } catch (err) {
    // Never let debug logging break the game
    console.error('[DebugLog] Error logging event:', err);
  }
}

// Helper to wrap handlers with rate limiting and error handling
function withRateLimit<T>(
  socket: TypedSocket,
  eventName: string,
  handler: () => T
): T | undefined {
  const { allowed, retryAfter } = checkRateLimit(socket.id, eventName);
  if (!allowed) {
    socket.emit('room:error', {
      code: 'RATE_LIMITED',
      message: `Too many requests. Try again in ${Math.ceil((retryAfter || 1000) / 1000)} seconds`,
    });
    return undefined;
  }
  return handler();
}

function cleanupGame(gameId: string, roomId: string): void {
  const game = gameService.getGame(gameId);

  // Save winner for next game (so they get left-of-dealer position)
  if (game?.winner) {
    roomService.setPreviousWinner(roomId, game.winner);
  }

  const engine = gameEngines.get(gameId);
  if (engine) {
    engine.cleanup();
    gameEngines.delete(gameId);
  }
  gameCreationLocks.delete(roomId);
  // Clear gameId from room so "Play Again" works
  roomService.clearGameId(roomId);
  // Remove persisted game state from database
  removePersistedGame(gameId);
}

function broadcastRoomList(io: TypedServer) {
  const rooms = roomService.getJoinableRooms();
  io.emit('lobby:roomList', rooms);
}

function handlePlayerLeave(io: TypedServer, socket: TypedSocket, immediate: boolean) {
  const playerId = socketToPlayer.get(socket.id);
  if (!playerId) return;

  const room = roomService.getRoomByPlayerId(playerId);
  console.log(`[handlePlayerLeave] playerId: ${playerId}, immediate: ${immediate}, room: ${room?.id}, gameId: ${room?.gameId}`);

  // Clean up socket mappings
  socketToPlayer.delete(socket.id);

  if (room) {
    socket.leave(room.id);

    // If game is in progress, notify the engine about the disconnect
    if (room.gameId) {
      const engine = gameEngines.get(room.gameId);
      if (engine) {
        engine.handlePlayerDisconnect(playerId);
      }
    }

    // If game is in progress, use grace period for reconnection
    if (room.gameId && !immediate) {
      // Clear stale socket mapping so grace period timeout can detect non-reconnection
      playerToSocket.delete(playerId);
      socket.to(room.id).emit('player:disconnected', playerId);

      // Set timeout for cleanup
      const timeout = setTimeout(async () => {
        disconnectTimeouts.delete(playerId);

        // Check if player reconnected before cleaning up
        const currentSocketId = playerToSocket.get(playerId);
        if (currentSocketId) {
          // Player reconnected, skip cleanup
          return;
        }

        // Player didn't reconnect, clean up
        await invalidatePlayerSession(playerId);
        console.log(`Player ${playerId} did not reconnect within grace period`);
      }, DISCONNECT_GRACE_PERIOD);

      disconnectTimeouts.set(playerId, timeout);
    } else {
      // Clear any existing timeout
      const existingTimeout = disconnectTimeouts.get(playerId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        disconnectTimeouts.delete(playerId);
      }

      if (!room.gameId && !immediate) {
        // Pre-game room: give grace period for reconnection (e.g., copying room code)
        console.log(`[handlePlayerLeave] Setting ${ROOM_GRACE_PERIOD/1000}s grace period for pre-game room`);
        socket.to(room.id).emit('player:disconnected', playerId);

        const timeout = setTimeout(async () => {
          console.log(`[handlePlayerLeave] Grace period expired for ${playerId}`);
          disconnectTimeouts.delete(playerId);

          // Check if player reconnected
          const currentSocketId = playerToSocket.get(playerId);
          if (!currentSocketId) {
            playerToSocket.delete(playerId);
            await invalidatePlayerSession(playerId);

            const { room: updatedRoom, wasDeleted } = roomService.leaveRoom(playerId);

            if (!wasDeleted && updatedRoom) {
              io.to(updatedRoom.id).emit('room:updated', updatedRoom);
            }

            broadcastRoomList(io);
            console.log(`Player ${playerId} did not reconnect to room within grace period`);
          }
        }, ROOM_GRACE_PERIOD);

        disconnectTimeouts.set(playerId, timeout);
      } else {
        // Immediate leave requested
        playerToSocket.delete(playerId);
        void invalidatePlayerSession(playerId);

        if (!room.gameId) {
          const { room: updatedRoom, wasDeleted } = roomService.leaveRoom(playerId);

          if (!wasDeleted && updatedRoom) {
            io.to(updatedRoom.id).emit('room:updated', updatedRoom);
          }

          broadcastRoomList(io);
        }
      }
    }
  } else {
    playerToSocket.delete(playerId);
    void invalidatePlayerSession(playerId);
  }
}

/**
 * Sync all active engine states to their game objects before DB flush.
 * Must be called during shutdown BEFORE flushAllGames().
 */
export function syncAllEnginesForShutdown(): void {
  for (const [gameId, engine] of gameEngines) {
    try {
      engine.syncStateForPersist();
    } catch (err) {
      console.error(`[Shutdown] Failed to sync engine ${gameId}:`, err);
    }
  }
  console.log(`[Shutdown] Synced ${gameEngines.size} engine(s)`);
}

export function setupSocketHandlers(io: TypedServer) {
  io.on('connection', (socket: TypedSocket) => {
    // IP connection limiting
    const clientIP = socket.handshake.headers['x-forwarded-for']
      ? String(socket.handshake.headers['x-forwarded-for']).split(',')[0].trim()
      : socket.handshake.address;

    if (!trackIPConnection(clientIP)) {
      console.log(`[Connection] Rejected: too many connections from IP ${clientIP}`);
      socket.emit('room:error', { code: 'TOO_MANY_CONNECTIONS', message: 'Too many connections from your IP' });
      socket.disconnect(true);
      return;
    }
    socketToIP.set(socket.id, clientIP);

    // Send current room list to newly connected client
    socket.emit('lobby:roomList', roomService.getJoinableRooms());

    // Create context for this connection
    const ctx: HandlerContext = {
      io,
      socketToPlayer,
      playerToSocket,
      gameEngines,
      gameCreationLocks,
      disconnectTimeouts,
      socketToIP,
      DISCONNECT_GRACE_PERIOD,
      ROOM_GRACE_PERIOD,
      logEvent,
      cleanupGame: (gameId, roomId) => cleanupGame(gameId, roomId),
      broadcastRoomList: () => broadcastRoomList(io),
      handlePlayerLeave: (s, immediate) => handlePlayerLeave(io, s, immediate),
      withRateLimit,
    };

    // Register handlers
    registerRoomHandlers(socket, ctx);
    registerGameHandlers(socket, ctx);
    registerConnectionHandlers(socket, ctx);
  });
}

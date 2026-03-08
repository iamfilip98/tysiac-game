import type { ClientToServerEvents, ServerToClientEvents } from '@tysiac/shared';
import * as roomService from '../services/roomService.js';
import * as gameService from '../services/gameService.js';
import * as debugService from '../services/debugService.js';
import { GameEngine } from '../game/engine.js';
import { checkRateLimit, trackIPConnection } from '../security/rateLimit.js';
import { invalidatePlayerSession } from '../security/session.js';
import { verifyToken } from '@clerk/backend';
import { ensureClerkPlayer } from '../services/statsService.js';
import { removePersistedGame } from '../services/persistenceService.js';
import { registerRoomHandlers } from './roomHandlers.js';
import { registerGameHandlers } from './gameHandlers.js';
import { registerConnectionHandlers } from './connectionHandlers.js';
import { registerMatchmakingHandlers, initMatchmaking } from './matchmakingHandlers.js';
import { registerEmoteHandlers } from './emoteHandlers.js';
import * as matchmakingService from '../services/matchmakingService.js';
import type { HandlerContext, TypedSocket, TypedServer } from './handlerContext.js';

// Module-level state
const socketToPlayer = new Map<string, string>();
const playerToSocket = new Map<string, string>();
const gameEngines = new Map<string, GameEngine>();
const gameCreationLocks = new Set<string>();
const disconnectTimeouts = new Map<string, NodeJS.Timeout>();
const aiReplacementTimeouts = new Map<string, NodeJS.Timeout>();
const DISCONNECT_GRACE_PERIOD = 300000; // 5 minutes for in-game (matches pre-game)
const ROOM_GRACE_PERIOD = 300000; // 5 minutes for pre-game rooms
const AI_REPLACEMENT_DELAY = 60_000; // 60s before AI takes over
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
  // Remove from matchmaking queue if queued
  const removedFromQueue = matchmakingService.removeBySocketId(socket.id);
  if (removedFromQueue) {
    socket.leave('matchmaking-queue');
    if (matchmakingService.getQueueSize() === 0) {
      matchmakingService.cancelFillTimer();
    } else {
      io.to('matchmaking-queue').emit('matchmaking:searching', { playersFound: matchmakingService.getQueueSize() });
    }
  }

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

      // Set 60s AI replacement timer
      const aiTimeout = setTimeout(() => {
        aiReplacementTimeouts.delete(playerId);

        // Check if player reconnected
        if (playerToSocket.has(playerId)) return;

        const currentRoom = roomService.getRoomByPlayerId(playerId);
        if (!currentRoom?.gameId) return;

        const engine = gameEngines.get(currentRoom.gameId);
        if (!engine) return;

        engine.replacePlayerWithAI(playerId);
        roomService.replacePlayerWithAI(currentRoom.id, playerId);

        const updatedRoom = roomService.getRoom(currentRoom.id);
        if (updatedRoom) {
          io.to(currentRoom.id).emit('room:updated', updatedRoom);
        }

        console.log(`Player ${playerId} replaced with AI after ${AI_REPLACEMENT_DELAY / 1000}s disconnect`);
        logEvent({ socketId: socket.id, eventType: 'player:aiReplacement', result: 'success', metadata: { playerId, roomId: currentRoom.id, gameId: currentRoom.gameId } });
      }, AI_REPLACEMENT_DELAY);

      aiReplacementTimeouts.set(playerId, aiTimeout);

      // Set 5-minute session invalidation timeout
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

      // Check if any human players remain connected
      const connectedHumans = room.players.filter(p =>
        !p.isAI && playerToSocket.has(p.id)
      );

      if (connectedHumans.length === 0) {
        // All humans disconnected — start 10-minute abandon timer
        const abandonKey = `abandon:${room.id}`;
        if (!disconnectTimeouts.has(abandonKey)) {
          const abandonTimer = setTimeout(() => {
            disconnectTimeouts.delete(abandonKey);
            const currentRoom = roomService.getRoom(room.id);
            if (!currentRoom) return;

            // Re-check — someone may have reconnected
            const stillConnected = currentRoom.players.filter(p =>
              !p.isAI && playerToSocket.has(p.id)
            );
            if (stillConnected.length > 0) return;

            // Abandon: clean up game and room
            if (currentRoom.gameId) {
              cleanupGame(currentRoom.gameId, room.id);
            }
            for (const player of currentRoom.players) {
              if (!player.isAI) {
                playerToSocket.delete(player.id);
                socketToPlayer.delete(player.id); // may not exist, that's fine
              }
            }
            // Delete the room
            roomService.leaveRoom(currentRoom.players[0]?.id || '');

            logEvent({
              socketId: socket.id,
              eventType: 'game:abandoned',
              result: 'success',
              metadata: {
                roomId: room.id,
                reason: 'all_players_disconnected',
              },
            });
          }, 10 * 60 * 1000); // 10 minutes
          disconnectTimeouts.set(abandonKey, abandonTimer);
        }
      }
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

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || '';

export function setupSocketHandlers(io: TypedServer) {
  io.on('connection', async (socket: TypedSocket) => {
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

    // Resolve authenticated player from Clerk JWT (if provided)
    let authenticatedPlayerId: string | null = null;
    const authToken = socket.handshake.auth?.token as string | undefined;
    if (authToken && CLERK_SECRET_KEY) {
      try {
        const decoded = await verifyToken(authToken, { secretKey: CLERK_SECRET_KEY });
        authenticatedPlayerId = decoded.sub; // Clerk user ID like "user_2xABC..."
        // Fire-and-forget: ensure player + stats rows exist
        ensureClerkPlayer(decoded.sub).catch(() => {});
      } catch { /* guest — no auth */ }
    }

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
      aiReplacementTimeouts,
      socketToIP,
      authenticatedPlayerId,
      DISCONNECT_GRACE_PERIOD,
      ROOM_GRACE_PERIOD,
      AI_REPLACEMENT_DELAY,
      logEvent,
      cleanupGame: (gameId, roomId) => {
        cleanupGame(gameId, roomId);
        // Broadcast updated room so clients know gameId is cleared and can "Play Again"
        const updatedRoom = roomService.getRoom(roomId);
        if (updatedRoom) {
          io.to(roomId).emit('room:updated', updatedRoom);
        }
      },
      broadcastRoomList: () => broadcastRoomList(io),
      handlePlayerLeave: (s, immediate) => handlePlayerLeave(io, s, immediate),
      withRateLimit,
    };

    // Register handlers
    registerRoomHandlers(socket, ctx);
    registerGameHandlers(socket, ctx);
    registerConnectionHandlers(socket, ctx);
    registerMatchmakingHandlers(socket, ctx);
    registerEmoteHandlers(socket, ctx);

    // Initialize matchmaking fill-timeout callback (once)
    initMatchmaking(ctx);
  });
}

import { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, Room, ClientGameState, ValidAction, Card, Suit } from '@tysiac/shared';
import * as roomService from '../services/roomService.js';
import * as gameService from '../services/gameService.js';
import * as debugService from '../services/debugService.js';
import { GameEngine } from '../game/engine.js';
import { getValidActions, getClientGameState } from '../game/stateManager.js';
import { getValidCards } from '../game/validation.js';
import { checkRateLimit, clearRateLimits } from '../security/rateLimit.js';
import { createSession, validateSession, invalidatePlayerSession, getSessionToken } from '../security/session.js';
import {
  CreateRoomSchema,
  JoinRoomSchema,
  BidAmountSchema,
  TalonDistributionSchema,
  CardSchema,
  SuitSchema,
  ReconnectSchema,
} from '../validation/schemas.js';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

// Store socket -> player mapping
const socketToPlayer = new Map<string, string>();
const playerToSocket = new Map<string, string>();

// Store game engines with cleanup callbacks
const gameEngines = new Map<string, GameEngine>();

// Track pending game creations to prevent race conditions
const gameCreationLocks = new Set<string>();

// Disconnect timeout tracking for graceful reconnection
const disconnectTimeouts = new Map<string, NodeJS.Timeout>();
const DISCONNECT_GRACE_PERIOD = 60000; // 60 seconds for in-game
const ROOM_GRACE_PERIOD = 300000; // 5 minutes for pre-game rooms

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
  const engine = gameEngines.get(gameId);
  if (engine) {
    engine.cleanup();
    gameEngines.delete(gameId);
  }
  gameCreationLocks.delete(roomId);
  // Clear gameId from room so "Play Again" works
  roomService.clearGameId(roomId);
}

export function setupSocketHandlers(io: TypedServer) {
  io.on('connection', (socket: TypedSocket) => {

    // Room events
    socket.on('room:create', (data) => {
      withRateLimit(socket, 'room:create', () => {
        try {
          const parsed = CreateRoomSchema.safeParse(data);
          if (!parsed.success) {
            logEvent({ socketId: socket.id, eventType: 'room:create', eventData: data, result: 'rejected', errorMessage: 'Invalid room data' });
            socket.emit('room:error', { code: 'INVALID_INPUT', message: 'Invalid room data' });
            return;
          }

          const { playerName, roomName, isPrivate, maxPlayers } = parsed.data;
          const playerId = `player-${socket.id}`;

          // Clear any existing mappings for this socket
          const existingPlayer = socketToPlayer.get(socket.id);
          if (existingPlayer) {
            playerToSocket.delete(existingPlayer);
            invalidatePlayerSession(existingPlayer);
          }

          socketToPlayer.set(socket.id, playerId);
          playerToSocket.set(playerId, socket.id);

          const room = roomService.createRoom(playerId, playerName, roomName, isPrivate, maxPlayers);
          const sessionToken = createSession(playerId, room.id);

          socket.join(room.id);
          socket.emit('room:created', { ...room, sessionToken });
          broadcastRoomList(io);

          logEvent({ socketId: socket.id, eventType: 'room:create', eventData: parsed.data, result: 'success', metadata: { roomId: room.id, roomCode: room.code } });
        } catch (error) {
          console.error('Error creating room:', error);
          logEvent({ socketId: socket.id, eventType: 'room:create', eventData: data, result: 'error', errorMessage: String(error) });
          socket.emit('room:error', { code: 'SERVER_ERROR', message: 'Failed to create room' });
        }
      });
    });

    socket.on('room:join', (data) => {
      withRateLimit(socket, 'room:join', () => {
        try {
          const parsed = JoinRoomSchema.safeParse(data);
          if (!parsed.success) {
            logEvent({ socketId: socket.id, eventType: 'room:join', eventData: data, result: 'rejected', errorMessage: 'Invalid join data' });
            socket.emit('room:error', { code: 'INVALID_INPUT', message: 'Invalid join data' });
            return;
          }

          const { playerName, roomCode } = parsed.data;
          const room = roomService.getRoomByCode(roomCode);

          if (!room) {
            logEvent({ socketId: socket.id, eventType: 'room:join', eventData: parsed.data, result: 'rejected', errorMessage: 'Room not found' });
            socket.emit('room:error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
            return;
          }

          if (room.players.length >= 3) {
            logEvent({ socketId: socket.id, eventType: 'room:join', eventData: parsed.data, result: 'rejected', errorMessage: 'Room is full', metadata: { roomId: room.id } });
            socket.emit('room:error', { code: 'ROOM_FULL', message: 'Room is full' });
            return;
          }

          if (room.gameId) {
            logEvent({ socketId: socket.id, eventType: 'room:join', eventData: parsed.data, result: 'rejected', errorMessage: 'Game already in progress', metadata: { roomId: room.id, gameId: room.gameId } });
            socket.emit('room:error', { code: 'GAME_IN_PROGRESS', message: 'Game already in progress' });
            return;
          }

          const playerId = `player-${socket.id}`;

          // Clear any existing mappings for this socket
          const existingPlayer = socketToPlayer.get(socket.id);
          if (existingPlayer) {
            playerToSocket.delete(existingPlayer);
            invalidatePlayerSession(existingPlayer);
          }

          socketToPlayer.set(socket.id, playerId);
          playerToSocket.set(playerId, socket.id);

          const updatedRoom = roomService.joinRoom(room.id, playerId, playerName);
          if (!updatedRoom) {
            logEvent({ socketId: socket.id, eventType: 'room:join', eventData: parsed.data, result: 'error', errorMessage: 'Failed to join room', metadata: { roomId: room.id } });
            socket.emit('room:error', { code: 'JOIN_FAILED', message: 'Failed to join room' });
            return;
          }

          const sessionToken = createSession(playerId, updatedRoom.id);

          socket.join(updatedRoom.id);
          socket.emit('room:joined', { room: updatedRoom, playerId, sessionToken });
          socket.to(updatedRoom.id).emit('room:updated', updatedRoom);
          broadcastRoomList(io);

          logEvent({ socketId: socket.id, eventType: 'room:join', eventData: parsed.data, result: 'success', metadata: { roomId: updatedRoom.id, playerId } });
        } catch (error) {
          console.error('Error joining room:', error);
          logEvent({ socketId: socket.id, eventType: 'room:join', eventData: data, result: 'error', errorMessage: String(error) });
          socket.emit('room:error', { code: 'SERVER_ERROR', message: 'Failed to join room' });
        }
      });
    });

    socket.on('room:leave', () => {
      withRateLimit(socket, 'room:leave', () => {
        try {
          handlePlayerLeave(io, socket, true);
        } catch (error) {
          console.error('Error leaving room:', error);
        }
      });
    });

    socket.on('room:ready', (isReady) => {
      withRateLimit(socket, 'room:ready', () => {
        try {
          if (typeof isReady !== 'boolean') {
            socket.emit('room:error', { code: 'INVALID_INPUT', message: 'Invalid ready state' });
            return;
          }

          const playerId = socketToPlayer.get(socket.id);
          if (!playerId) {
            socket.emit('room:error', { code: 'NOT_IN_ROOM', message: 'You must be in a room' });
            return;
          }

          const room = roomService.setPlayerReady(playerId, isReady);
          if (room) {
            io.to(room.id).emit('room:updated', room);
          } else {
            socket.emit('room:error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
          }
        } catch (error) {
          console.error('Error setting ready:', error);
          socket.emit('room:error', { code: 'SERVER_ERROR', message: 'Failed to set ready state' });
        }
      });
    });

    socket.on('room:addAI', () => {
      withRateLimit(socket, 'room:addAI', () => {
        try {
          const playerId = socketToPlayer.get(socket.id);
          if (!playerId) {
            socket.emit('room:error', { code: 'NOT_IN_ROOM', message: 'You must be in a room' });
            return;
          }

          const room = roomService.getRoomByPlayerId(playerId);
          if (!room || room.hostId !== playerId) {
            socket.emit('room:error', { code: 'NOT_HOST', message: 'Only the host can add AI' });
            return;
          }

          const updatedRoom = roomService.addAI(room.id);
          if (updatedRoom) {
            io.to(updatedRoom.id).emit('room:updated', updatedRoom);
          }
        } catch (error) {
          console.error('Error adding AI:', error);
          socket.emit('room:error', { code: 'SERVER_ERROR', message: 'Failed to add AI' });
        }
      });
    });

    socket.on('room:removeAI', (aiId) => {
      withRateLimit(socket, 'room:removeAI', () => {
        try {
          if (typeof aiId !== 'string') {
            socket.emit('room:error', { code: 'INVALID_INPUT', message: 'Invalid AI ID' });
            return;
          }

          const playerId = socketToPlayer.get(socket.id);
          if (!playerId) {
            socket.emit('room:error', { code: 'NOT_IN_ROOM', message: 'You must be in a room' });
            return;
          }

          const room = roomService.getRoomByPlayerId(playerId);
          if (!room || room.hostId !== playerId) {
            socket.emit('room:error', { code: 'NOT_HOST', message: 'Only the host can remove AI' });
            return;
          }

          const updatedRoom = roomService.removeAI(room.id, aiId);
          if (updatedRoom) {
            io.to(updatedRoom.id).emit('room:updated', updatedRoom);
          }
        } catch (error) {
          console.error('Error removing AI:', error);
          socket.emit('room:error', { code: 'SERVER_ERROR', message: 'Failed to remove AI' });
        }
      });
    });

    socket.on('room:startGame', () => {
      withRateLimit(socket, 'room:startGame', () => {
        try {
          const playerId = socketToPlayer.get(socket.id);
          if (!playerId) {
            console.log('[room:startGame] Failed: No playerId for socket', socket.id);
            logEvent({ socketId: socket.id, eventType: 'room:startGame', result: 'rejected', errorMessage: 'Not in room' });
            socket.emit('room:error', { code: 'NOT_IN_ROOM', message: 'You must be in a room to start the game' });
            return;
          }

          const room = roomService.getRoomByPlayerId(playerId);
          if (!room) {
            console.log('[room:startGame] Failed: No room found for player', playerId);
            logEvent({ socketId: socket.id, eventType: 'room:startGame', result: 'rejected', errorMessage: 'Room not found' });
            socket.emit('room:error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
            return;
          }

          if (room.hostId !== playerId) {
            console.log('[room:startGame] Failed: Player is not host', { playerId, hostId: room.hostId });
            logEvent({ socketId: socket.id, eventType: 'room:startGame', result: 'rejected', errorMessage: 'Not host', metadata: { hostId: room.hostId } });
            socket.emit('room:error', { code: 'NOT_HOST', message: 'Only the host can start the game' });
            return;
          }

          // Prevent race condition with lock
          if (gameCreationLocks.has(room.id)) {
            console.log('[room:startGame] Failed: Game creation already in progress for room', room.id);
            logEvent({ socketId: socket.id, eventType: 'room:startGame', result: 'rejected', errorMessage: 'Game creation locked' });
            socket.emit('room:error', { code: 'GAME_STARTING', message: 'Game is already starting' });
            return;
          }

          if (room.gameId) {
            console.log('[room:startGame] Failed: Game already exists', { roomId: room.id, gameId: room.gameId });
            logEvent({ socketId: socket.id, eventType: 'room:startGame', result: 'rejected', errorMessage: 'Game already exists', metadata: { existingGameId: room.gameId } });
            socket.emit('room:error', { code: 'GAME_EXISTS', message: 'Game already exists' });
            return;
          }

          if (!roomService.canStartGame(room)) {
            const readyStatus = room.players.map(p => ({ id: p.id, name: p.name, isReady: p.isReady, isAI: p.isAI }));
            console.log('[room:startGame] Failed: canStartGame returned false', {
              roomId: room.id,
              playerCount: room.players.length,
              readyStatus
            });
            logEvent({ socketId: socket.id, eventType: 'room:startGame', result: 'rejected', errorMessage: 'Cannot start - players not ready', metadata: { playerCount: room.players.length, readyStatus } });
            socket.emit('room:error', { code: 'CANNOT_START', message: 'Cannot start game yet - need 3 players and all human players must be ready' });
            return;
          }

          console.log('[room:startGame] Starting game for room', room.id);

          // Set lock
          gameCreationLocks.add(room.id);

          // Create game
          const players = room.players.map(p => ({ id: p.id, name: p.name, isAI: p.isAI }));
          const game = gameService.createGame(room.id, players);
          roomService.setGameId(room.id, game.id);

          // Create game engine with cleanup callback and socket lookup
          const engine = new GameEngine(
            game,
            io,
            room.id,
            () => cleanupGame(game.id, room.id),
            (playerId: string) => playerToSocket.get(playerId) || null
          );
          gameEngines.set(game.id, engine);

          // Start the game - engine will broadcast initial state to all players
          engine.startGame();

          // Notify clients that room now has a gameId
          const updatedRoom = roomService.getRoom(room.id);
          console.log('[room:startGame] Broadcasting room:updated', {
            roomId: updatedRoom?.id,
            gameId: updatedRoom?.gameId,
            playerCount: updatedRoom?.players.length
          });
          if (updatedRoom) {
            io.to(room.id).emit('room:updated', updatedRoom);
          }

          logEvent({ socketId: socket.id, eventType: 'room:startGame', result: 'success', metadata: { gameId: game.id, players: players.map(p => ({ id: p.id, name: p.name, isAI: p.isAI })) } });
        } catch (error) {
          console.error('Error starting game:', error);
          logEvent({ socketId: socket.id, eventType: 'room:startGame', result: 'error', errorMessage: String(error) });
          socket.emit('room:error', { code: 'SERVER_ERROR', message: 'Failed to start game' });
          // Release lock on error
          const playerId = socketToPlayer.get(socket.id);
          if (playerId) {
            const room = roomService.getRoomByPlayerId(playerId);
            if (room) {
              gameCreationLocks.delete(room.id);
            }
          }
        }
      });
    });

    // Game events
    socket.on('game:bid', (amount) => {
      withRateLimit(socket, 'game:bid', () => {
        try {
          const parsed = BidAmountSchema.safeParse(amount);
          if (!parsed.success) {
            logEvent({ socketId: socket.id, eventType: 'game:bid', eventData: { amount }, result: 'rejected', errorMessage: 'Invalid bid amount' });
            socket.emit('game:error', { code: 'INVALID_INPUT', message: 'Invalid bid amount' });
            return;
          }

          const playerId = socketToPlayer.get(socket.id);
          if (!playerId) {
            logEvent({ socketId: socket.id, eventType: 'game:bid', eventData: { amount: parsed.data }, result: 'rejected', errorMessage: 'Not in room' });
            socket.emit('game:error', { code: 'NOT_IN_ROOM', message: 'You must be in a room' });
            return;
          }

          const room = roomService.getRoomByPlayerId(playerId);
          if (!room || !room.gameId) {
            logEvent({ socketId: socket.id, eventType: 'game:bid', eventData: { amount: parsed.data }, result: 'rejected', errorMessage: 'No active game' });
            socket.emit('game:error', { code: 'NO_GAME', message: 'No active game' });
            return;
          }

          const engine = gameEngines.get(room.gameId);
          if (!engine) {
            logEvent({ socketId: socket.id, eventType: 'game:bid', eventData: { amount: parsed.data }, result: 'rejected', errorMessage: 'Game engine not found' });
            socket.emit('game:error', { code: 'NO_GAME', message: 'Game engine not found' });
            return;
          }

          logEvent({ socketId: socket.id, eventType: 'game:bid', eventData: { amount: parsed.data }, result: 'success' });
          engine.handleBid(playerId, parsed.data);
        } catch (error) {
          console.error('Error handling bid:', error);
          logEvent({ socketId: socket.id, eventType: 'game:bid', eventData: { amount }, result: 'error', errorMessage: String(error) });
          socket.emit('game:error', { code: 'SERVER_ERROR', message: 'Failed to process bid' });
        }
      });
    });

    socket.on('game:pass', () => {
      withRateLimit(socket, 'game:pass', () => {
        try {
          const playerId = socketToPlayer.get(socket.id);
          if (!playerId) {
            logEvent({ socketId: socket.id, eventType: 'game:pass', result: 'rejected', errorMessage: 'Not in room' });
            socket.emit('game:error', { code: 'NOT_IN_ROOM', message: 'You must be in a room' });
            return;
          }

          const room = roomService.getRoomByPlayerId(playerId);
          if (!room || !room.gameId) {
            logEvent({ socketId: socket.id, eventType: 'game:pass', result: 'rejected', errorMessage: 'No active game' });
            socket.emit('game:error', { code: 'NO_GAME', message: 'No active game' });
            return;
          }

          const engine = gameEngines.get(room.gameId);
          if (!engine) {
            logEvent({ socketId: socket.id, eventType: 'game:pass', result: 'rejected', errorMessage: 'Game engine not found' });
            socket.emit('game:error', { code: 'NO_GAME', message: 'Game engine not found' });
            return;
          }

          logEvent({ socketId: socket.id, eventType: 'game:pass', result: 'success' });
          engine.handlePass(playerId);
        } catch (error) {
          console.error('Error handling pass:', error);
          logEvent({ socketId: socket.id, eventType: 'game:pass', result: 'error', errorMessage: String(error) });
          socket.emit('game:error', { code: 'SERVER_ERROR', message: 'Failed to process pass' });
        }
      });
    });

    socket.on('game:confirmTalon', () => {
      withRateLimit(socket, 'game:confirmTalon', () => {
        try {
          const playerId = socketToPlayer.get(socket.id);
          if (!playerId) {
            logEvent({ socketId: socket.id, eventType: 'game:confirmTalon', result: 'rejected', errorMessage: 'Not in room' });
            socket.emit('game:error', { code: 'NOT_IN_ROOM', message: 'You must be in a room' });
            return;
          }

          const room = roomService.getRoomByPlayerId(playerId);
          if (!room || !room.gameId) {
            logEvent({ socketId: socket.id, eventType: 'game:confirmTalon', result: 'rejected', errorMessage: 'No active game' });
            socket.emit('game:error', { code: 'NO_GAME', message: 'No active game' });
            return;
          }

          const engine = gameEngines.get(room.gameId);
          if (!engine) {
            logEvent({ socketId: socket.id, eventType: 'game:confirmTalon', result: 'rejected', errorMessage: 'Game engine not found' });
            socket.emit('game:error', { code: 'NO_GAME', message: 'Game engine not found' });
            return;
          }

          // Get talon cards for debugging
          const game = gameService.getGame(room.gameId);
          logEvent({
            socketId: socket.id,
            eventType: 'game:confirmTalon',
            result: 'success',
            metadata: { talon: game?.currentRound?.talon?.map(c => `${c.rank}${c.suit}`) }
          });
          engine.handleConfirmTalon(playerId);
        } catch (error) {
          console.error('Error confirming talon:', error);
          logEvent({ socketId: socket.id, eventType: 'game:confirmTalon', result: 'error', errorMessage: String(error) });
          socket.emit('game:error', { code: 'SERVER_ERROR', message: 'Failed to confirm talon' });
        }
      });
    });

    socket.on('game:confirmWykladana', () => {
      withRateLimit(socket, 'game:confirmWykladana', () => {
        try {
          const playerId = socketToPlayer.get(socket.id);
          if (!playerId) {
            logEvent({ socketId: socket.id, eventType: 'game:confirmWykladana', result: 'rejected', errorMessage: 'Not in room' });
            socket.emit('game:error', { code: 'NOT_IN_ROOM', message: 'You must be in a room' });
            return;
          }

          const room = roomService.getRoomByPlayerId(playerId);
          if (!room || !room.gameId) {
            logEvent({ socketId: socket.id, eventType: 'game:confirmWykladana', result: 'rejected', errorMessage: 'No active game' });
            socket.emit('game:error', { code: 'NO_GAME', message: 'No active game' });
            return;
          }

          const engine = gameEngines.get(room.gameId);
          if (!engine) {
            logEvent({ socketId: socket.id, eventType: 'game:confirmWykladana', result: 'rejected', errorMessage: 'Game engine not found' });
            socket.emit('game:error', { code: 'NO_GAME', message: 'Game engine not found' });
            return;
          }

          logEvent({
            socketId: socket.id,
            eventType: 'game:confirmWykladana',
            result: 'success',
          });
          engine.handleConfirmWykladana(playerId);
        } catch (error) {
          console.error('Error confirming wykladana:', error);
          logEvent({ socketId: socket.id, eventType: 'game:confirmWykladana', result: 'error', errorMessage: String(error) });
          socket.emit('game:error', { code: 'SERVER_ERROR', message: 'Failed to confirm wykladana' });
        }
      });
    });

    socket.on('game:playOrPass', (decision) => {
      withRateLimit(socket, 'game:playOrPass', () => {
        try {
          if (decision !== 'play' && decision !== 'pass') {
            logEvent({ socketId: socket.id, eventType: 'game:playOrPass', eventData: { decision }, result: 'rejected', errorMessage: 'Invalid decision' });
            socket.emit('game:error', { code: 'INVALID_INPUT', message: 'Invalid decision' });
            return;
          }

          const playerId = socketToPlayer.get(socket.id);
          if (!playerId) {
            logEvent({ socketId: socket.id, eventType: 'game:playOrPass', eventData: { decision }, result: 'rejected', errorMessage: 'Not in room' });
            socket.emit('game:error', { code: 'NOT_IN_ROOM', message: 'You must be in a room' });
            return;
          }

          const room = roomService.getRoomByPlayerId(playerId);
          if (!room || !room.gameId) {
            logEvent({ socketId: socket.id, eventType: 'game:playOrPass', eventData: { decision }, result: 'rejected', errorMessage: 'No active game' });
            socket.emit('game:error', { code: 'NO_GAME', message: 'No active game' });
            return;
          }

          const engine = gameEngines.get(room.gameId);
          if (!engine) {
            logEvent({ socketId: socket.id, eventType: 'game:playOrPass', eventData: { decision }, result: 'rejected', errorMessage: 'Game engine not found' });
            socket.emit('game:error', { code: 'NO_GAME', message: 'Game engine not found' });
            return;
          }

          logEvent({ socketId: socket.id, eventType: 'game:playOrPass', eventData: { decision }, result: 'success' });
          engine.handlePlayOrPass(playerId, decision);
        } catch (error) {
          console.error('Error handling play/pass decision:', error);
          logEvent({ socketId: socket.id, eventType: 'game:playOrPass', eventData: { decision }, result: 'error', errorMessage: String(error) });
          socket.emit('game:error', { code: 'SERVER_ERROR', message: 'Failed to process decision' });
        }
      });
    });

    socket.on('game:distributeTalon', (distribution) => {
      withRateLimit(socket, 'game:distributeTalon', () => {
        try {
          const parsed = TalonDistributionSchema.safeParse(distribution);
          if (!parsed.success) {
            logEvent({ socketId: socket.id, eventType: 'game:distributeTalon', eventData: { distribution }, result: 'rejected', errorMessage: 'Invalid distribution' });
            socket.emit('game:error', { code: 'INVALID_INPUT', message: 'Invalid distribution' });
            return;
          }

          const playerId = socketToPlayer.get(socket.id);
          if (!playerId) {
            logEvent({ socketId: socket.id, eventType: 'game:distributeTalon', eventData: parsed.data, result: 'rejected', errorMessage: 'Not in room' });
            socket.emit('game:error', { code: 'NOT_IN_ROOM', message: 'You must be in a room' });
            return;
          }

          const room = roomService.getRoomByPlayerId(playerId);
          if (!room || !room.gameId) {
            logEvent({ socketId: socket.id, eventType: 'game:distributeTalon', eventData: parsed.data, result: 'rejected', errorMessage: 'No active game' });
            socket.emit('game:error', { code: 'NO_GAME', message: 'No active game' });
            return;
          }

          const engine = gameEngines.get(room.gameId);
          if (!engine) {
            logEvent({ socketId: socket.id, eventType: 'game:distributeTalon', eventData: parsed.data, result: 'rejected', errorMessage: 'Game engine not found' });
            socket.emit('game:error', { code: 'NO_GAME', message: 'Game engine not found' });
            return;
          }

          logEvent({ socketId: socket.id, eventType: 'game:distributeTalon', eventData: parsed.data, result: 'success' });
          engine.handleDistributeTalon(playerId, parsed.data);
        } catch (error) {
          console.error('Error distributing talon:', error);
          logEvent({ socketId: socket.id, eventType: 'game:distributeTalon', eventData: { distribution }, result: 'error', errorMessage: String(error) });
          socket.emit('game:error', { code: 'SERVER_ERROR', message: 'Failed to distribute talon' });
        }
      });
    });

    socket.on('game:playCard', (card) => {
      withRateLimit(socket, 'game:playCard', () => {
        try {
          const parsed = CardSchema.safeParse(card);
          if (!parsed.success) {
            logEvent({ socketId: socket.id, eventType: 'game:playCard', eventData: { card }, result: 'rejected', errorMessage: 'Invalid card' });
            socket.emit('game:error', { code: 'INVALID_INPUT', message: 'Invalid card' });
            return;
          }

          const playerId = socketToPlayer.get(socket.id);
          if (!playerId) {
            logEvent({ socketId: socket.id, eventType: 'game:playCard', eventData: { card: parsed.data }, result: 'rejected', errorMessage: 'Not in room' });
            socket.emit('game:error', { code: 'NOT_IN_ROOM', message: 'You must be in a room' });
            return;
          }

          const room = roomService.getRoomByPlayerId(playerId);
          if (!room || !room.gameId) {
            logEvent({ socketId: socket.id, eventType: 'game:playCard', eventData: { card: parsed.data }, result: 'rejected', errorMessage: 'No active game' });
            socket.emit('game:error', { code: 'NO_GAME', message: 'No active game' });
            return;
          }

          const engine = gameEngines.get(room.gameId);
          if (!engine) {
            logEvent({ socketId: socket.id, eventType: 'game:playCard', eventData: { card: parsed.data }, result: 'rejected', errorMessage: 'Game engine not found' });
            socket.emit('game:error', { code: 'NO_GAME', message: 'Game engine not found' });
            return;
          }

          // Get player's hand for debugging context
          const game = gameService.getGame(room.gameId);
          const playerHand = game?.currentRound?.players[playerId]?.hand || [];

          logEvent({
            socketId: socket.id,
            eventType: 'game:playCard',
            eventData: { card: parsed.data },
            result: 'success',
            metadata: {
              playerHand: playerHand.map(c => `${c.rank}${c.suit}`),
              currentTrick: game?.currentRound?.currentTrick,
              trumpSuit: game?.currentRound?.trumpSuit,
            }
          });
          engine.handlePlayCard(playerId, parsed.data);
        } catch (error) {
          console.error('Error playing card:', error);
          logEvent({ socketId: socket.id, eventType: 'game:playCard', eventData: { card }, result: 'error', errorMessage: String(error) });
          socket.emit('game:error', { code: 'SERVER_ERROR', message: 'Failed to play card' });
        }
      });
    });

    socket.on('game:declareMarriage', (suit) => {
      withRateLimit(socket, 'game:declareMarriage', () => {
        try {
          const parsed = SuitSchema.safeParse(suit);
          if (!parsed.success) {
            logEvent({ socketId: socket.id, eventType: 'game:declareMarriage', eventData: { suit }, result: 'rejected', errorMessage: 'Invalid suit' });
            socket.emit('game:error', { code: 'INVALID_INPUT', message: 'Invalid suit' });
            return;
          }

          const playerId = socketToPlayer.get(socket.id);
          if (!playerId) {
            logEvent({ socketId: socket.id, eventType: 'game:declareMarriage', eventData: { suit: parsed.data }, result: 'rejected', errorMessage: 'Not in room' });
            socket.emit('game:error', { code: 'NOT_IN_ROOM', message: 'You must be in a room' });
            return;
          }

          const room = roomService.getRoomByPlayerId(playerId);
          if (!room || !room.gameId) {
            logEvent({ socketId: socket.id, eventType: 'game:declareMarriage', eventData: { suit: parsed.data }, result: 'rejected', errorMessage: 'No active game' });
            socket.emit('game:error', { code: 'NO_GAME', message: 'No active game' });
            return;
          }

          const engine = gameEngines.get(room.gameId);
          if (!engine) {
            logEvent({ socketId: socket.id, eventType: 'game:declareMarriage', eventData: { suit: parsed.data }, result: 'rejected', errorMessage: 'Game engine not found' });
            socket.emit('game:error', { code: 'NO_GAME', message: 'Game engine not found' });
            return;
          }

          logEvent({ socketId: socket.id, eventType: 'game:declareMarriage', eventData: { suit: parsed.data }, result: 'success' });
          engine.handleDeclareMarriage(playerId, parsed.data);
        } catch (error) {
          console.error('Error declaring marriage:', error);
          logEvent({ socketId: socket.id, eventType: 'game:declareMarriage', eventData: { suit }, result: 'error', errorMessage: String(error) });
          socket.emit('game:error', { code: 'SERVER_ERROR', message: 'Failed to declare marriage' });
        }
      });
    });

    socket.on('game:leave', () => {
      withRateLimit(socket, 'game:leave', () => {
        try {
          const playerId = socketToPlayer.get(socket.id);
          if (!playerId) {
            socket.emit('game:error', { code: 'NOT_IN_ROOM', message: 'You must be in a room' });
            return;
          }

          const room = roomService.getRoomByPlayerId(playerId);
          if (!room || !room.gameId) {
            socket.emit('game:error', { code: 'NO_GAME', message: 'No active game' });
            return;
          }

          const engine = gameEngines.get(room.gameId);
          if (!engine) {
            socket.emit('game:error', { code: 'NO_GAME', message: 'Game engine not found' });
            return;
          }

          // Get player name before replacing
          const player = room.players.find(p => p.id === playerId);
          const playerName = player?.name || 'Player';

          // Replace player with AI in the game engine
          engine.replacePlayerWithAI(playerId);

          // Update room to mark player as AI
          roomService.replacePlayerWithAI(room.id, playerId);

          // Clean up player mappings
          socketToPlayer.delete(socket.id);
          playerToSocket.delete(playerId);
          invalidatePlayerSession(playerId);

          // Leave the socket room
          socket.leave(room.id);

          // Notify other players
          io.to(room.id).emit('game:playerReplacedByAI', { playerId, playerName });

          // Broadcast updated room
          const updatedRoom = roomService.getRoom(room.id);
          if (updatedRoom) {
            io.to(room.id).emit('room:updated', updatedRoom);
          }

          console.log(`Player ${playerId} left game and was replaced by AI`);
        } catch (error) {
          console.error('Error leaving game:', error);
          socket.emit('game:error', { code: 'SERVER_ERROR', message: 'Failed to leave game' });
        }
      });
    });

    // Reconnection with session validation
    socket.on('player:reconnect', (data) => {
      withRateLimit(socket, 'player:reconnect', () => {
        try {
          const parsed = ReconnectSchema.safeParse(data);
          if (!parsed.success) {
            logEvent({ socketId: socket.id, eventType: 'player:reconnect', eventData: data, result: 'rejected', errorMessage: 'Invalid reconnect data' });
            socket.emit('room:error', { code: 'INVALID_INPUT', message: 'Invalid reconnect data' });
            return;
          }

          const { roomId, playerId, sessionToken } = parsed.data;

          // Validate session token
          if (!validateSession(sessionToken, playerId)) {
            logEvent({ socketId: socket.id, eventType: 'player:reconnect', eventData: { roomId, playerId }, result: 'rejected', errorMessage: 'Invalid or expired session' });
            socket.emit('room:error', { code: 'INVALID_SESSION', message: 'Invalid or expired session' });
            return;
          }

          const room = roomService.getRoom(roomId);
          if (!room) {
            socket.emit('room:error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
            return;
          }

          if (!room.players.some(p => p.id === playerId)) {
            socket.emit('room:error', { code: 'NOT_IN_ROOM', message: 'Player not in room' });
            return;
          }

          // Cancel any pending disconnect timeout
          const timeout = disconnectTimeouts.get(playerId);
          if (timeout) {
            clearTimeout(timeout);
            disconnectTimeouts.delete(playerId);
          }

          // Clear old socket mapping if exists
          const oldSocketId = playerToSocket.get(playerId);
          if (oldSocketId && oldSocketId !== socket.id) {
            socketToPlayer.delete(oldSocketId);
          }

          // Update mappings
          socketToPlayer.set(socket.id, playerId);
          playerToSocket.set(playerId, socket.id);
          socket.join(roomId);

          // Get game state if exists
          let gameState: ClientGameState | null = null;
          let validActions: ValidAction[] = [];

          if (room.gameId) {
            const game = gameService.getGame(room.gameId);

            if (game) {
              gameState = getClientGameState(game, playerId);

              // Ensure engine exists for future actions
              let engine = gameEngines.get(room.gameId);
              if (!engine) {
                engine = new GameEngine(
                  game,
                  io,
                  room.id,
                  () => cleanupGame(game.id, room.id),
                  (pid: string) => playerToSocket.get(pid) || null,
                  true
                );
                gameEngines.set(room.gameId, engine);
              }

              // Calculate valid actions directly from game state
              const round = game.currentRound;

              if (round && game.phase === 'trickPlaying' && round.currentTrick?.currentPlayer === playerId) {
                const hand = round.players[playerId]?.hand || [];
                const validCards = getValidCards(hand, round.currentTrick, round.trumpSuit, game);
                validActions = [{ type: 'playCard' as const, validCards }];
              } else if (round && game.phase === 'bidding') {
                validActions = getValidActions(game, playerId, {
                  currentBidder: playerId,
                  currentBid: round.finalBid,
                  passedPlayers: [],
                });
              }

              // Notify player if it's their turn
              engine.notifyPlayerIfTheirTurn(playerId);

              logEvent({ socketId: socket.id, eventType: 'player:reconnect', eventData: { roomId, playerId }, result: 'success', metadata: { hasActiveGame: true, phase: game?.phase } });
              socket.emit('connection:restored', { room, gameState, validActions });
              socket.to(roomId).emit('player:reconnected', playerId);
              return;
            }
          }

          logEvent({ socketId: socket.id, eventType: 'player:reconnect', eventData: { roomId, playerId }, result: 'success', metadata: { hasActiveGame: false } });
          socket.emit('connection:restored', { room, gameState, validActions });
          socket.to(roomId).emit('player:reconnected', playerId);
        } catch (error) {
          console.error('[RECONNECT] Error:', error);
          logEvent({ socketId: socket.id, eventType: 'player:reconnect', eventData: data, result: 'error', errorMessage: String(error) });
          socket.emit('room:error', { code: 'SERVER_ERROR', message: 'Failed to reconnect' });
        }
      });
    });

    // Disconnection with grace period
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      logEvent({ socketId: socket.id, eventType: 'disconnect', result: 'success' });
      clearRateLimits(socket.id);
      handlePlayerLeave(io, socket, false);
    });
  });
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
      socket.to(room.id).emit('player:disconnected', playerId);

      // Set timeout for cleanup
      const timeout = setTimeout(() => {
        disconnectTimeouts.delete(playerId);
        playerToSocket.delete(playerId);
        invalidatePlayerSession(playerId);

        // If still disconnected after grace period, handle as leave
        const currentSocketId = playerToSocket.get(playerId);
        if (!currentSocketId) {
          // Player didn't reconnect, handle game state accordingly
          console.log(`Player ${playerId} did not reconnect within grace period`);
        }
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

        const timeout = setTimeout(() => {
          console.log(`[handlePlayerLeave] Grace period expired for ${playerId}`);
          disconnectTimeouts.delete(playerId);

          // Check if player reconnected
          const currentSocketId = playerToSocket.get(playerId);
          if (!currentSocketId) {
            playerToSocket.delete(playerId);
            invalidatePlayerSession(playerId);

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
        invalidatePlayerSession(playerId);

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
    invalidatePlayerSession(playerId);
  }
}

function broadcastRoomList(io: TypedServer) {
  const rooms = roomService.getPublicRooms();
  io.emit('lobby:roomList', rooms);
}

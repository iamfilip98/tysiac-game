import { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, Room, ClientGameState, ValidAction, Card, Suit } from '@tysiac/shared';
import * as roomService from '../services/roomService.js';
import * as gameService from '../services/gameService.js';
import { GameEngine } from '../game/engine.js';
import { getValidActions, getClientGameState } from '../game/stateManager.js';
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
const DISCONNECT_GRACE_PERIOD = 60000; // 60 seconds

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
}

export function setupSocketHandlers(io: TypedServer) {
  io.on('connection', (socket: TypedSocket) => {
    console.log(`Client connected: ${socket.id}`);

    // Room events
    socket.on('room:create', (data) => {
      withRateLimit(socket, 'room:create', () => {
        try {
          const parsed = CreateRoomSchema.safeParse(data);
          if (!parsed.success) {
            socket.emit('room:error', { code: 'INVALID_INPUT', message: 'Invalid room data' });
            return;
          }

          const { playerName, roomName, isPrivate } = parsed.data;
          const playerId = `player-${socket.id}`;

          // Clear any existing mappings for this socket
          const existingPlayer = socketToPlayer.get(socket.id);
          if (existingPlayer) {
            playerToSocket.delete(existingPlayer);
            invalidatePlayerSession(existingPlayer);
          }

          socketToPlayer.set(socket.id, playerId);
          playerToSocket.set(playerId, socket.id);

          const room = roomService.createRoom(playerId, playerName, roomName, isPrivate);
          const sessionToken = createSession(playerId, room.id);

          socket.join(room.id);
          socket.emit('room:created', { ...room, sessionToken });
          broadcastRoomList(io);
        } catch (error) {
          console.error('Error creating room:', error);
          socket.emit('room:error', { code: 'SERVER_ERROR', message: 'Failed to create room' });
        }
      });
    });

    socket.on('room:join', (data) => {
      withRateLimit(socket, 'room:join', () => {
        try {
          const parsed = JoinRoomSchema.safeParse(data);
          if (!parsed.success) {
            socket.emit('room:error', { code: 'INVALID_INPUT', message: 'Invalid join data' });
            return;
          }

          const { playerName, roomCode } = parsed.data;
          const room = roomService.getRoomByCode(roomCode);

          if (!room) {
            socket.emit('room:error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
            return;
          }

          if (room.players.length >= 3) {
            socket.emit('room:error', { code: 'ROOM_FULL', message: 'Room is full' });
            return;
          }

          if (room.gameId) {
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
            socket.emit('room:error', { code: 'JOIN_FAILED', message: 'Failed to join room' });
            return;
          }

          const sessionToken = createSession(playerId, updatedRoom.id);

          socket.join(updatedRoom.id);
          socket.emit('room:joined', { room: updatedRoom, playerId, sessionToken });
          socket.to(updatedRoom.id).emit('room:updated', updatedRoom);
          broadcastRoomList(io);
        } catch (error) {
          console.error('Error joining room:', error);
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
            socket.emit('room:error', { code: 'NOT_IN_ROOM', message: 'You must be in a room to start the game' });
            return;
          }

          const room = roomService.getRoomByPlayerId(playerId);
          if (!room) {
            console.log('[room:startGame] Failed: No room found for player', playerId);
            socket.emit('room:error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
            return;
          }

          if (room.hostId !== playerId) {
            console.log('[room:startGame] Failed: Player is not host', { playerId, hostId: room.hostId });
            socket.emit('room:error', { code: 'NOT_HOST', message: 'Only the host can start the game' });
            return;
          }

          // Prevent race condition with lock
          if (gameCreationLocks.has(room.id)) {
            console.log('[room:startGame] Failed: Game creation already in progress for room', room.id);
            socket.emit('room:error', { code: 'GAME_STARTING', message: 'Game is already starting' });
            return;
          }

          if (room.gameId) {
            console.log('[room:startGame] Failed: Game already exists', { roomId: room.id, gameId: room.gameId });
            socket.emit('room:error', { code: 'GAME_EXISTS', message: 'Game already exists' });
            return;
          }

          if (!roomService.canStartGame(room)) {
            console.log('[room:startGame] Failed: canStartGame returned false', {
              roomId: room.id,
              playerCount: room.players.length,
              readyStatus: room.players.map(p => ({ id: p.id, name: p.name, isReady: p.isReady, isAI: p.isAI }))
            });
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
        } catch (error) {
          console.error('Error starting game:', error);
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
            socket.emit('game:error', { code: 'INVALID_INPUT', message: 'Invalid bid amount' });
            return;
          }

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

          engine.handleBid(playerId, parsed.data);
        } catch (error) {
          console.error('Error handling bid:', error);
          socket.emit('game:error', { code: 'SERVER_ERROR', message: 'Failed to process bid' });
        }
      });
    });

    socket.on('game:pass', () => {
      withRateLimit(socket, 'game:pass', () => {
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

          engine.handlePass(playerId);
        } catch (error) {
          console.error('Error handling pass:', error);
          socket.emit('game:error', { code: 'SERVER_ERROR', message: 'Failed to process pass' });
        }
      });
    });

    socket.on('game:confirmTalon', () => {
      withRateLimit(socket, 'game:confirmTalon', () => {
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

          engine.handleConfirmTalon(playerId);
        } catch (error) {
          console.error('Error confirming talon:', error);
          socket.emit('game:error', { code: 'SERVER_ERROR', message: 'Failed to confirm talon' });
        }
      });
    });

    socket.on('game:distributeTalon', (distribution) => {
      withRateLimit(socket, 'game:distributeTalon', () => {
        try {
          const parsed = TalonDistributionSchema.safeParse(distribution);
          if (!parsed.success) {
            socket.emit('game:error', { code: 'INVALID_INPUT', message: 'Invalid distribution' });
            return;
          }

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

          engine.handleDistributeTalon(playerId, parsed.data);
        } catch (error) {
          console.error('Error distributing talon:', error);
          socket.emit('game:error', { code: 'SERVER_ERROR', message: 'Failed to distribute talon' });
        }
      });
    });

    socket.on('game:playCard', (card) => {
      withRateLimit(socket, 'game:playCard', () => {
        try {
          const parsed = CardSchema.safeParse(card);
          if (!parsed.success) {
            socket.emit('game:error', { code: 'INVALID_INPUT', message: 'Invalid card' });
            return;
          }

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

          engine.handlePlayCard(playerId, parsed.data);
        } catch (error) {
          console.error('Error playing card:', error);
          socket.emit('game:error', { code: 'SERVER_ERROR', message: 'Failed to play card' });
        }
      });
    });

    socket.on('game:declareMarriage', (suit) => {
      withRateLimit(socket, 'game:declareMarriage', () => {
        try {
          const parsed = SuitSchema.safeParse(suit);
          if (!parsed.success) {
            socket.emit('game:error', { code: 'INVALID_INPUT', message: 'Invalid suit' });
            return;
          }

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

          engine.handleDeclareMarriage(playerId, parsed.data);
        } catch (error) {
          console.error('Error declaring marriage:', error);
          socket.emit('game:error', { code: 'SERVER_ERROR', message: 'Failed to declare marriage' });
        }
      });
    });

    // Reconnection with session validation
    socket.on('player:reconnect', (data) => {
      withRateLimit(socket, 'player:reconnect', () => {
        try {
          const parsed = ReconnectSchema.safeParse(data);
          if (!parsed.success) {
            socket.emit('room:error', { code: 'INVALID_INPUT', message: 'Invalid reconnect data' });
            return;
          }

          const { roomId, playerId, sessionToken } = parsed.data;

          // Validate session token
          if (!validateSession(sessionToken, playerId)) {
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
          if (room.gameId) {
            const game = gameService.getGame(room.gameId);
            if (game) {
              gameState = getClientGameState(game, playerId);
            }
          }

          socket.emit('connection:restored', { room, gameState });
          socket.to(roomId).emit('player:reconnected', playerId);
        } catch (error) {
          console.error('Error reconnecting:', error);
          socket.emit('room:error', { code: 'SERVER_ERROR', message: 'Failed to reconnect' });
        }
      });
    });

    // Disconnection with grace period
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      clearRateLimits(socket.id);
      handlePlayerLeave(io, socket, false);
    });
  });
}

function handlePlayerLeave(io: TypedServer, socket: TypedSocket, immediate: boolean) {
  const playerId = socketToPlayer.get(socket.id);
  if (!playerId) return;

  const room = roomService.getRoomByPlayerId(playerId);

  // Clean up socket mappings
  socketToPlayer.delete(socket.id);

  if (room) {
    socket.leave(room.id);

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
      // Immediate leave or no game in progress
      playerToSocket.delete(playerId);
      invalidatePlayerSession(playerId);

      // Clear any existing timeout
      const timeout = disconnectTimeouts.get(playerId);
      if (timeout) {
        clearTimeout(timeout);
        disconnectTimeouts.delete(playerId);
      }

      if (!room.gameId) {
        const { room: updatedRoom, wasDeleted } = roomService.leaveRoom(playerId);

        if (!wasDeleted && updatedRoom) {
          io.to(updatedRoom.id).emit('room:updated', updatedRoom);
        }

        broadcastRoomList(io);
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

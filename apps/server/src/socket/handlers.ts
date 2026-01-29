import { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, Room, ClientGameState, ValidAction, Card, Suit } from '@tysiac/shared';
import * as roomService from '../services/roomService.js';
import * as gameService from '../services/gameService.js';
import { GameEngine } from '../game/engine.js';
import { getValidActions, getClientGameState } from '../game/stateManager.js';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

// Store socket -> player mapping
const socketToPlayer = new Map<string, string>();
const playerToSocket = new Map<string, string>();

// Store game engines
const gameEngines = new Map<string, GameEngine>();

export function setupSocketHandlers(io: TypedServer) {
  io.on('connection', (socket: TypedSocket) => {
    console.log(`Client connected: ${socket.id}`);

    // Room events
    socket.on('room:create', ({ playerName, roomName, isPrivate }) => {
      const playerId = `player-${socket.id}`;
      socketToPlayer.set(socket.id, playerId);
      playerToSocket.set(playerId, socket.id);

      const room = roomService.createRoom(playerId, playerName, roomName, isPrivate);
      socket.join(room.id);

      socket.emit('room:created', room);
      broadcastRoomList(io);
    });

    socket.on('room:join', ({ playerName, roomCode }) => {
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
      socketToPlayer.set(socket.id, playerId);
      playerToSocket.set(playerId, socket.id);

      const updatedRoom = roomService.joinRoom(room.id, playerId, playerName);
      if (!updatedRoom) {
        socket.emit('room:error', { code: 'JOIN_FAILED', message: 'Failed to join room' });
        return;
      }

      socket.join(updatedRoom.id);
      socket.emit('room:joined', { room: updatedRoom, playerId });

      // Notify others
      socket.to(updatedRoom.id).emit('room:updated', updatedRoom);
      broadcastRoomList(io);
    });

    socket.on('room:leave', () => {
      handlePlayerLeave(io, socket);
    });

    socket.on('room:ready', (isReady) => {
      const playerId = socketToPlayer.get(socket.id);
      if (!playerId) return;

      const room = roomService.setPlayerReady(playerId, isReady);
      if (room) {
        io.to(room.id).emit('room:updated', room);
      }
    });

    socket.on('room:addAI', () => {
      const playerId = socketToPlayer.get(socket.id);
      if (!playerId) return;

      const room = roomService.getRoomByPlayerId(playerId);
      if (!room || room.hostId !== playerId) return;

      const updatedRoom = roomService.addAI(room.id);
      if (updatedRoom) {
        io.to(updatedRoom.id).emit('room:updated', updatedRoom);
      }
    });

    socket.on('room:removeAI', (aiId) => {
      const playerId = socketToPlayer.get(socket.id);
      if (!playerId) return;

      const room = roomService.getRoomByPlayerId(playerId);
      if (!room || room.hostId !== playerId) return;

      const updatedRoom = roomService.removeAI(room.id, aiId);
      if (updatedRoom) {
        io.to(updatedRoom.id).emit('room:updated', updatedRoom);
      }
    });

    socket.on('room:startGame', () => {
      const playerId = socketToPlayer.get(socket.id);
      if (!playerId) return;

      const room = roomService.getRoomByPlayerId(playerId);
      if (!room || room.hostId !== playerId) return;

      if (!roomService.canStartGame(room)) {
        socket.emit('room:error', { code: 'CANNOT_START', message: 'Cannot start game yet' });
        return;
      }

      // Create game
      const players = room.players.map(p => ({ id: p.id, name: p.name, isAI: p.isAI }));
      const game = gameService.createGame(room.id, players);
      roomService.setGameId(room.id, game.id);

      // Create game engine
      const engine = new GameEngine(game, io, room.id);
      gameEngines.set(game.id, engine);

      // Emit game:started event to all players
      io.to(room.id).emit('game:started', { gameId: game.id });

      // Start the game
      engine.startGame();
    });

    // Game events
    socket.on('game:bid', (amount) => {
      const playerId = socketToPlayer.get(socket.id);
      if (!playerId) return;

      const room = roomService.getRoomByPlayerId(playerId);
      if (!room || !room.gameId) return;

      const engine = gameEngines.get(room.gameId);
      if (!engine) return;

      engine.handleBid(playerId, amount);
    });

    socket.on('game:pass', () => {
      const playerId = socketToPlayer.get(socket.id);
      if (!playerId) return;

      const room = roomService.getRoomByPlayerId(playerId);
      if (!room || !room.gameId) return;

      const engine = gameEngines.get(room.gameId);
      if (!engine) return;

      engine.handlePass(playerId);
    });

    socket.on('game:distributeTalon', (distribution) => {
      const playerId = socketToPlayer.get(socket.id);
      if (!playerId) return;

      const room = roomService.getRoomByPlayerId(playerId);
      if (!room || !room.gameId) return;

      const engine = gameEngines.get(room.gameId);
      if (!engine) return;

      engine.handleDistributeTalon(playerId, distribution);
    });

    socket.on('game:playCard', (card) => {
      const playerId = socketToPlayer.get(socket.id);
      if (!playerId) return;

      const room = roomService.getRoomByPlayerId(playerId);
      if (!room || !room.gameId) return;

      const engine = gameEngines.get(room.gameId);
      if (!engine) return;

      engine.handlePlayCard(playerId, card);
    });

    socket.on('game:declareMarriage', (suit) => {
      const playerId = socketToPlayer.get(socket.id);
      if (!playerId) return;

      const room = roomService.getRoomByPlayerId(playerId);
      if (!room || !room.gameId) return;

      const engine = gameEngines.get(room.gameId);
      if (!engine) return;

      engine.handleDeclareMarriage(playerId, suit);
    });

    // Reconnection
    socket.on('player:reconnect', ({ roomId, playerId }) => {
      const room = roomService.getRoom(roomId);
      if (!room) {
        socket.emit('room:error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
        return;
      }

      if (!room.players.some(p => p.id === playerId)) {
        socket.emit('room:error', { code: 'NOT_IN_ROOM', message: 'Player not in room' });
        return;
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
    });

    // Disconnection
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      handlePlayerLeave(io, socket);
    });
  });
}

function handlePlayerLeave(io: TypedServer, socket: TypedSocket) {
  const playerId = socketToPlayer.get(socket.id);
  if (!playerId) return;

  const room = roomService.getRoomByPlayerId(playerId);

  // Clean up mappings
  socketToPlayer.delete(socket.id);
  playerToSocket.delete(playerId);

  if (room) {
    socket.leave(room.id);

    // Notify others of disconnect (they might reconnect)
    socket.to(room.id).emit('player:disconnected', playerId);

    // If game is in progress, don't remove immediately (allow reconnect)
    if (!room.gameId) {
      const { room: updatedRoom, wasDeleted } = roomService.leaveRoom(playerId);

      if (!wasDeleted && updatedRoom) {
        io.to(updatedRoom.id).emit('room:updated', updatedRoom);
      }

      broadcastRoomList(io);
    }
  }
}

function broadcastRoomList(io: TypedServer) {
  const rooms = roomService.getPublicRooms();
  io.emit('lobby:roomList', rooms);
}

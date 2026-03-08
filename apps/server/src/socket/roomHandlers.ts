import type { HandlerContext, TypedSocket } from './handlerContext.js';
import * as roomService from '../services/roomService.js';
import * as gameService from '../services/gameService.js';
import { GameEngine } from '../game/engine.js';
import { createSession, invalidatePlayerSession } from '../security/session.js';
import { CreateRoomSchema, JoinRoomSchema } from '../validation/schemas.js';
import { persistGame } from '../services/persistenceService.js';

export function registerRoomHandlers(socket: TypedSocket, ctx: HandlerContext): void {
  socket.on('room:create', (data) => {
    ctx.withRateLimit(socket, 'room:create', async () => {
      try {
        const parsed = CreateRoomSchema.safeParse(data);
        if (!parsed.success) {
          ctx.logEvent({ socketId: socket.id, eventType: 'room:create', eventData: data, result: 'rejected', errorMessage: 'Invalid room data' });
          socket.emit('room:error', { code: 'INVALID_INPUT', message: 'Invalid room data' });
          return;
        }

        const { playerName, roomName, isPrivate, maxPlayers } = parsed.data;
        const playerId = ctx.authenticatedPlayerId || `player-${socket.id}`;

        // Reject if this socket already has a player in a room
        const existingPlayer = ctx.socketToPlayer.get(socket.id);
        if (existingPlayer) {
          const existingRoom = roomService.getRoomByPlayerId(existingPlayer);
          if (existingRoom) {
            ctx.logEvent({ socketId: socket.id, eventType: 'room:create', eventData: parsed.data, result: 'rejected', errorMessage: 'Already in a room' });
            socket.emit('room:error', { code: 'ALREADY_IN_ROOM', message: 'You are already in a room' });
            return;
          }
          ctx.playerToSocket.delete(existingPlayer);
          await invalidatePlayerSession(existingPlayer);
        }

        ctx.socketToPlayer.set(socket.id, playerId);
        ctx.playerToSocket.set(playerId, socket.id);

        const room = roomService.createRoom(playerId, playerName, roomName, isPrivate, maxPlayers);
        if (ctx.authenticatedPlayerId) {
          roomService.setPlayerClerkId(playerId, ctx.authenticatedPlayerId);
        }
        const sessionToken = await createSession(playerId, room.id);

        socket.join(room.id);
        socket.emit('room:created', { ...room, sessionToken });
        ctx.broadcastRoomList();

        ctx.logEvent({ socketId: socket.id, eventType: 'room:create', eventData: parsed.data, result: 'success', metadata: { roomId: room.id, roomCode: room.code } });
      } catch (error) {
        console.error('Error creating room:', error);
        ctx.logEvent({ socketId: socket.id, eventType: 'room:create', eventData: data, result: 'error', errorMessage: String(error) });
        socket.emit('room:error', { code: 'SERVER_ERROR', message: 'Failed to create room' });
      }
    });
  });

  socket.on('room:join', (data) => {
    ctx.withRateLimit(socket, 'room:join', async () => {
      try {
        const parsed = JoinRoomSchema.safeParse(data);
        if (!parsed.success) {
          ctx.logEvent({ socketId: socket.id, eventType: 'room:join', eventData: data, result: 'rejected', errorMessage: 'Invalid join data' });
          socket.emit('room:error', { code: 'INVALID_INPUT', message: 'Invalid join data' });
          return;
        }

        const { playerName, roomCode } = parsed.data;
        const room = roomService.getRoomByCode(roomCode);

        if (!room) {
          ctx.logEvent({ socketId: socket.id, eventType: 'room:join', eventData: parsed.data, result: 'rejected', errorMessage: 'Room not found' });
          socket.emit('room:error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
          return;
        }

        // Check if this authenticated user already has a seat (replaced by AI)
        if (ctx.authenticatedPlayerId && room) {
          const existingPlayerId = roomService.getPlayerByClerkId(room.id, ctx.authenticatedPlayerId);
          if (existingPlayerId) {
            const existingPlayer = room.players.find(p => p.id === existingPlayerId);
            if (existingPlayer?.isAI) {
              // Reclaim seat instead of joining as new player
              const playerName = parsed.data.playerName || existingPlayer.name.replace(/\s*\[AI\]$/, '');
              roomService.reclaimFromAI(room.id, existingPlayerId, playerName);

              // Update socket mappings
              const oldExisting = ctx.socketToPlayer.get(socket.id);
              if (oldExisting) {
                ctx.playerToSocket.delete(oldExisting);
              }
              ctx.socketToPlayer.set(socket.id, existingPlayerId);
              ctx.playerToSocket.set(existingPlayerId, socket.id);
              socket.join(room.id);

              // Create new session
              const sessionToken = await createSession(existingPlayerId, room.id);

              // Reclaim in engine if game is active
              if (room.gameId) {
                const engine = ctx.gameEngines.get(room.gameId);
                if (engine) {
                  engine.reclaimFromAI(existingPlayerId);
                }
              }

              // Send response
              const updatedRoom = roomService.getRoom(room.id)!;
              socket.emit('room:joined', {
                room: updatedRoom,
                playerId: existingPlayerId,
                sessionToken,
              });
              ctx.io.to(room.id).emit('room:updated', updatedRoom);
              socket.to(room.id).emit('player:reconnected', existingPlayerId);
              ctx.broadcastRoomList();

              ctx.logEvent({ socketId: socket.id, eventType: 'player:reclaimed', eventData: parsed.data, result: 'success', metadata: { playerId: existingPlayerId, roomId: room.id, method: 'room_code_join' } });
              return;
            }
          }
        }

        if (room.players.length >= room.maxPlayers) {
          ctx.logEvent({ socketId: socket.id, eventType: 'room:join', eventData: parsed.data, result: 'rejected', errorMessage: 'Room is full', metadata: { roomId: room.id } });
          socket.emit('room:error', { code: 'ROOM_FULL', message: 'Room is full' });
          return;
        }

        if (room.gameId) {
          ctx.logEvent({ socketId: socket.id, eventType: 'room:join', eventData: parsed.data, result: 'rejected', errorMessage: 'Game already in progress', metadata: { roomId: room.id, gameId: room.gameId } });
          socket.emit('room:error', { code: 'GAME_IN_PROGRESS', message: 'Game already in progress' });
          return;
        }

        const playerId = ctx.authenticatedPlayerId || `player-${socket.id}`;

        // Clear any existing mappings for this socket
        const existingPlayer = ctx.socketToPlayer.get(socket.id);
        if (existingPlayer) {
          ctx.playerToSocket.delete(existingPlayer);
          await invalidatePlayerSession(existingPlayer);
        }

        ctx.socketToPlayer.set(socket.id, playerId);
        ctx.playerToSocket.set(playerId, socket.id);

        const updatedRoom = roomService.joinRoom(room.id, playerId, playerName);
        if (!updatedRoom) {
          ctx.logEvent({ socketId: socket.id, eventType: 'room:join', eventData: parsed.data, result: 'error', errorMessage: 'Failed to join room', metadata: { roomId: room.id } });
          socket.emit('room:error', { code: 'JOIN_FAILED', message: 'Failed to join room' });
          return;
        }

        if (ctx.authenticatedPlayerId) {
          roomService.setPlayerClerkId(playerId, ctx.authenticatedPlayerId);
        }

        const sessionToken = await createSession(playerId, updatedRoom.id);

        socket.join(updatedRoom.id);
        socket.emit('room:joined', { room: updatedRoom, playerId, sessionToken });
        socket.to(updatedRoom.id).emit('room:updated', updatedRoom);
        ctx.broadcastRoomList();

        ctx.logEvent({ socketId: socket.id, eventType: 'room:join', eventData: parsed.data, result: 'success', metadata: { roomId: updatedRoom.id, playerId } });
      } catch (error) {
        console.error('Error joining room:', error);
        ctx.logEvent({ socketId: socket.id, eventType: 'room:join', eventData: data, result: 'error', errorMessage: String(error) });
        socket.emit('room:error', { code: 'SERVER_ERROR', message: 'Failed to join room' });
      }
    });
  });

  socket.on('room:leave', () => {
    ctx.withRateLimit(socket, 'room:leave', () => {
      try {
        ctx.handlePlayerLeave(socket, true);
      } catch (error) {
        console.error('Error leaving room:', error);
      }
    });
  });

  socket.on('room:ready', (isReady) => {
    ctx.withRateLimit(socket, 'room:ready', () => {
      try {
        if (typeof isReady !== 'boolean') {
          socket.emit('room:error', { code: 'INVALID_INPUT', message: 'Invalid ready state' });
          return;
        }

        const playerId = ctx.socketToPlayer.get(socket.id);
        if (!playerId) {
          socket.emit('room:error', { code: 'NOT_IN_ROOM', message: 'You must be in a room' });
          return;
        }

        const room = roomService.setPlayerReady(playerId, isReady);
        if (room) {
          ctx.io.to(room.id).emit('room:updated', room);
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
    ctx.withRateLimit(socket, 'room:addAI', () => {
      try {
        const playerId = ctx.socketToPlayer.get(socket.id);
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
          ctx.io.to(updatedRoom.id).emit('room:updated', updatedRoom);
        }
      } catch (error) {
        console.error('Error adding AI:', error);
        socket.emit('room:error', { code: 'SERVER_ERROR', message: 'Failed to add AI' });
      }
    });
  });

  socket.on('room:removeAI', (aiId) => {
    ctx.withRateLimit(socket, 'room:removeAI', () => {
      try {
        if (typeof aiId !== 'string') {
          socket.emit('room:error', { code: 'INVALID_INPUT', message: 'Invalid AI ID' });
          return;
        }

        const playerId = ctx.socketToPlayer.get(socket.id);
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
          ctx.io.to(updatedRoom.id).emit('room:updated', updatedRoom);
        }
      } catch (error) {
        console.error('Error removing AI:', error);
        socket.emit('room:error', { code: 'SERVER_ERROR', message: 'Failed to remove AI' });
      }
    });
  });

  socket.on('room:startGame', () => {
    ctx.withRateLimit(socket, 'room:startGame', () => {
      try {
        const playerId = ctx.socketToPlayer.get(socket.id);
        if (!playerId) {
          console.log('[room:startGame] Failed: No playerId for socket', socket.id);
          ctx.logEvent({ socketId: socket.id, eventType: 'room:startGame', result: 'rejected', errorMessage: 'Not in room' });
          socket.emit('room:error', { code: 'NOT_IN_ROOM', message: 'You must be in a room to start the game' });
          return;
        }

        const room = roomService.getRoomByPlayerId(playerId);
        if (!room) {
          console.log('[room:startGame] Failed: No room found for player', playerId);
          ctx.logEvent({ socketId: socket.id, eventType: 'room:startGame', result: 'rejected', errorMessage: 'Room not found' });
          socket.emit('room:error', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
          return;
        }

        if (room.hostId !== playerId) {
          console.log('[room:startGame] Failed: Player is not host', { playerId, hostId: room.hostId });
          ctx.logEvent({ socketId: socket.id, eventType: 'room:startGame', result: 'rejected', errorMessage: 'Not host', metadata: { hostId: room.hostId } });
          socket.emit('room:error', { code: 'NOT_HOST', message: 'Only the host can start the game' });
          return;
        }

        // Prevent race condition with lock
        if (ctx.gameCreationLocks.has(room.id)) {
          console.log('[room:startGame] Failed: Game creation already in progress for room', room.id);
          ctx.logEvent({ socketId: socket.id, eventType: 'room:startGame', result: 'rejected', errorMessage: 'Game creation locked' });
          socket.emit('room:error', { code: 'GAME_STARTING', message: 'Game is already starting' });
          return;
        }

        if (room.gameId) {
          console.log('[room:startGame] Failed: Game already exists', { roomId: room.id, gameId: room.gameId });
          ctx.logEvent({ socketId: socket.id, eventType: 'room:startGame', result: 'rejected', errorMessage: 'Game already exists', metadata: { existingGameId: room.gameId } });
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
          ctx.logEvent({ socketId: socket.id, eventType: 'room:startGame', result: 'rejected', errorMessage: 'Cannot start - players not ready', metadata: { playerCount: room.players.length, readyStatus } });
          socket.emit('room:error', { code: 'CANNOT_START', message: 'Cannot start game yet - need 3 players and all human players must be ready' });
          return;
        }

        console.log('[room:startGame] Starting game for room', room.id);

        // Set lock
        ctx.gameCreationLocks.add(room.id);

        // Reorder players if there's a previous winner still in the room
        let players = room.players.map(p => ({ id: p.id, name: p.name, isAI: p.isAI }));

        if (room.previousWinner) {
          const winnerIndex = players.findIndex(p => p.id === room.previousWinner);

          if (winnerIndex !== -1) {
            // Rotate array so winner ends up at index 1 (left of dealer)
            const n = players.length;
            const rotation = (winnerIndex - 1 + n) % n;
            players = [...players.slice(rotation), ...players.slice(0, rotation)];
            console.log('[room:startGame] Reordered players for previous winner', { previousWinner: room.previousWinner, newOrder: players.map(p => p.id) });
          }

          roomService.clearPreviousWinner(room.id);
        }

        // Create game
        const game = gameService.createGame(room.id, players);
        roomService.setGameId(room.id, game.id);

        // Create game engine with cleanup callback, socket lookup, and persistence
        const engine = new GameEngine(
          game,
          ctx.io,
          room.id,
          () => { ctx.cleanupGame(game.id, room.id); ctx.broadcastRoomList(); },
          (pid: string) => ctx.playerToSocket.get(pid) || null,
          false,
          (g) => {
            const r = roomService.getRoom(g.roomId);
            if (r) persistGame(g, r);
          },
          room.isPrivate
        );
        ctx.gameEngines.set(game.id, engine);

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
          ctx.io.to(room.id).emit('room:updated', updatedRoom);
        }

        ctx.logEvent({ socketId: socket.id, eventType: 'room:startGame', result: 'success', metadata: { gameId: game.id, players: players.map(p => ({ id: p.id, name: p.name, isAI: p.isAI })) } });
      } catch (error) {
        console.error('Error starting game:', error);
        ctx.logEvent({ socketId: socket.id, eventType: 'room:startGame', result: 'error', errorMessage: String(error) });
        socket.emit('room:error', { code: 'SERVER_ERROR', message: 'Failed to start game' });
        // Release lock on error
        const playerId = ctx.socketToPlayer.get(socket.id);
        if (playerId) {
          const room = roomService.getRoomByPlayerId(playerId);
          if (room) {
            ctx.gameCreationLocks.delete(room.id);
          }
        }
      }
    });
  });
}

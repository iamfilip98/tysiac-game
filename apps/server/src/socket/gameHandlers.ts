import type { HandlerContext, TypedSocket } from './handlerContext.js';
import * as roomService from '../services/roomService.js';
import * as gameService from '../services/gameService.js';
import { invalidatePlayerSession } from '../security/session.js';
import {
  BidAmountSchema,
  TalonDistributionSchema,
  CardSchema,
  SuitSchema,
} from '../validation/schemas.js';

export function registerGameHandlers(socket: TypedSocket, ctx: HandlerContext): void {
  socket.on('game:bid', (amount) => {
    ctx.withRateLimit(socket, 'game:bid', () => {
      try {
        const parsed = BidAmountSchema.safeParse(amount);
        if (!parsed.success) {
          ctx.logEvent({ socketId: socket.id, eventType: 'game:bid', eventData: { amount }, result: 'rejected', errorMessage: 'Invalid bid amount' });
          socket.emit('game:error', { code: 'INVALID_INPUT', message: 'Invalid bid amount' });
          return;
        }

        const playerId = ctx.socketToPlayer.get(socket.id);
        if (!playerId) {
          ctx.logEvent({ socketId: socket.id, eventType: 'game:bid', eventData: { amount: parsed.data }, result: 'rejected', errorMessage: 'Not in room' });
          socket.emit('game:error', { code: 'NOT_IN_ROOM', message: 'You must be in a room' });
          return;
        }

        const room = roomService.getRoomByPlayerId(playerId);
        if (!room || !room.gameId) {
          ctx.logEvent({ socketId: socket.id, eventType: 'game:bid', eventData: { amount: parsed.data }, result: 'rejected', errorMessage: 'No active game' });
          socket.emit('game:error', { code: 'NO_GAME', message: 'No active game' });
          return;
        }

        const engine = ctx.gameEngines.get(room.gameId);
        if (!engine) {
          ctx.logEvent({ socketId: socket.id, eventType: 'game:bid', eventData: { amount: parsed.data }, result: 'rejected', errorMessage: 'Game engine not found' });
          socket.emit('game:error', { code: 'NO_GAME', message: 'Game engine not found' });
          return;
        }

        ctx.logEvent({ socketId: socket.id, eventType: 'game:bid', eventData: { amount: parsed.data }, result: 'success' });
        engine.handleBid(playerId, parsed.data);
      } catch (error) {
        console.error('Error handling bid:', error);
        ctx.logEvent({ socketId: socket.id, eventType: 'game:bid', eventData: { amount }, result: 'error', errorMessage: String(error) });
        socket.emit('game:error', { code: 'SERVER_ERROR', message: 'Failed to process bid' });
      }
    });
  });

  socket.on('game:pass', () => {
    ctx.withRateLimit(socket, 'game:pass', () => {
      try {
        const playerId = ctx.socketToPlayer.get(socket.id);
        if (!playerId) {
          ctx.logEvent({ socketId: socket.id, eventType: 'game:pass', result: 'rejected', errorMessage: 'Not in room' });
          socket.emit('game:error', { code: 'NOT_IN_ROOM', message: 'You must be in a room' });
          return;
        }

        const room = roomService.getRoomByPlayerId(playerId);
        if (!room || !room.gameId) {
          ctx.logEvent({ socketId: socket.id, eventType: 'game:pass', result: 'rejected', errorMessage: 'No active game' });
          socket.emit('game:error', { code: 'NO_GAME', message: 'No active game' });
          return;
        }

        const engine = ctx.gameEngines.get(room.gameId);
        if (!engine) {
          ctx.logEvent({ socketId: socket.id, eventType: 'game:pass', result: 'rejected', errorMessage: 'Game engine not found' });
          socket.emit('game:error', { code: 'NO_GAME', message: 'Game engine not found' });
          return;
        }

        ctx.logEvent({ socketId: socket.id, eventType: 'game:pass', result: 'success' });
        engine.handlePass(playerId);
      } catch (error) {
        console.error('Error handling pass:', error);
        ctx.logEvent({ socketId: socket.id, eventType: 'game:pass', result: 'error', errorMessage: String(error) });
        socket.emit('game:error', { code: 'SERVER_ERROR', message: 'Failed to process pass' });
      }
    });
  });

  socket.on('game:confirmTalon', () => {
    ctx.withRateLimit(socket, 'game:confirmTalon', () => {
      try {
        const playerId = ctx.socketToPlayer.get(socket.id);
        if (!playerId) {
          ctx.logEvent({ socketId: socket.id, eventType: 'game:confirmTalon', result: 'rejected', errorMessage: 'Not in room' });
          socket.emit('game:error', { code: 'NOT_IN_ROOM', message: 'You must be in a room' });
          return;
        }

        const room = roomService.getRoomByPlayerId(playerId);
        if (!room || !room.gameId) {
          ctx.logEvent({ socketId: socket.id, eventType: 'game:confirmTalon', result: 'rejected', errorMessage: 'No active game' });
          socket.emit('game:error', { code: 'NO_GAME', message: 'No active game' });
          return;
        }

        const engine = ctx.gameEngines.get(room.gameId);
        if (!engine) {
          ctx.logEvent({ socketId: socket.id, eventType: 'game:confirmTalon', result: 'rejected', errorMessage: 'Game engine not found' });
          socket.emit('game:error', { code: 'NO_GAME', message: 'Game engine not found' });
          return;
        }

        // Get talon cards for debugging
        const game = gameService.getGame(room.gameId);
        ctx.logEvent({
          socketId: socket.id,
          eventType: 'game:confirmTalon',
          result: 'success',
          metadata: { talon: game?.currentRound?.talon?.map(c => `${c.rank}${c.suit}`) }
        });
        engine.handleConfirmTalon(playerId);
      } catch (error) {
        console.error('Error confirming talon:', error);
        ctx.logEvent({ socketId: socket.id, eventType: 'game:confirmTalon', result: 'error', errorMessage: String(error) });
        socket.emit('game:error', { code: 'SERVER_ERROR', message: 'Failed to confirm talon' });
      }
    });
  });

  socket.on('game:confirmWykladana', () => {
    ctx.withRateLimit(socket, 'game:confirmWykladana', () => {
      try {
        const playerId = ctx.socketToPlayer.get(socket.id);
        if (!playerId) {
          ctx.logEvent({ socketId: socket.id, eventType: 'game:confirmWykladana', result: 'rejected', errorMessage: 'Not in room' });
          socket.emit('game:error', { code: 'NOT_IN_ROOM', message: 'You must be in a room' });
          return;
        }

        const room = roomService.getRoomByPlayerId(playerId);
        if (!room || !room.gameId) {
          ctx.logEvent({ socketId: socket.id, eventType: 'game:confirmWykladana', result: 'rejected', errorMessage: 'No active game' });
          socket.emit('game:error', { code: 'NO_GAME', message: 'No active game' });
          return;
        }

        const engine = ctx.gameEngines.get(room.gameId);
        if (!engine) {
          ctx.logEvent({ socketId: socket.id, eventType: 'game:confirmWykladana', result: 'rejected', errorMessage: 'Game engine not found' });
          socket.emit('game:error', { code: 'NO_GAME', message: 'Game engine not found' });
          return;
        }

        ctx.logEvent({
          socketId: socket.id,
          eventType: 'game:confirmWykladana',
          result: 'success',
        });
        engine.handleConfirmWykladana(playerId);
      } catch (error) {
        console.error('Error confirming wykladana:', error);
        ctx.logEvent({ socketId: socket.id, eventType: 'game:confirmWykladana', result: 'error', errorMessage: String(error) });
        socket.emit('game:error', { code: 'SERVER_ERROR', message: 'Failed to confirm wykladana' });
      }
    });
  });

  socket.on('game:playOrPass', (decision) => {
    ctx.withRateLimit(socket, 'game:playOrPass', () => {
      try {
        if (decision !== 'play' && decision !== 'pass') {
          ctx.logEvent({ socketId: socket.id, eventType: 'game:playOrPass', eventData: { decision }, result: 'rejected', errorMessage: 'Invalid decision' });
          socket.emit('game:error', { code: 'INVALID_INPUT', message: 'Invalid decision' });
          return;
        }

        const playerId = ctx.socketToPlayer.get(socket.id);
        if (!playerId) {
          ctx.logEvent({ socketId: socket.id, eventType: 'game:playOrPass', eventData: { decision }, result: 'rejected', errorMessage: 'Not in room' });
          socket.emit('game:error', { code: 'NOT_IN_ROOM', message: 'You must be in a room' });
          return;
        }

        const room = roomService.getRoomByPlayerId(playerId);
        if (!room || !room.gameId) {
          ctx.logEvent({ socketId: socket.id, eventType: 'game:playOrPass', eventData: { decision }, result: 'rejected', errorMessage: 'No active game' });
          socket.emit('game:error', { code: 'NO_GAME', message: 'No active game' });
          return;
        }

        const engine = ctx.gameEngines.get(room.gameId);
        if (!engine) {
          ctx.logEvent({ socketId: socket.id, eventType: 'game:playOrPass', eventData: { decision }, result: 'rejected', errorMessage: 'Game engine not found' });
          socket.emit('game:error', { code: 'NO_GAME', message: 'Game engine not found' });
          return;
        }

        ctx.logEvent({ socketId: socket.id, eventType: 'game:playOrPass', eventData: { decision }, result: 'success' });
        engine.handlePlayOrPass(playerId, decision);
      } catch (error) {
        console.error('Error handling play/pass decision:', error);
        ctx.logEvent({ socketId: socket.id, eventType: 'game:playOrPass', eventData: { decision }, result: 'error', errorMessage: String(error) });
        socket.emit('game:error', { code: 'SERVER_ERROR', message: 'Failed to process decision' });
      }
    });
  });

  socket.on('game:distributeTalon', (distribution) => {
    ctx.withRateLimit(socket, 'game:distributeTalon', () => {
      try {
        const parsed = TalonDistributionSchema.safeParse(distribution);
        if (!parsed.success) {
          ctx.logEvent({ socketId: socket.id, eventType: 'game:distributeTalon', eventData: { distribution }, result: 'rejected', errorMessage: 'Invalid distribution' });
          socket.emit('game:error', { code: 'INVALID_INPUT', message: 'Invalid distribution' });
          return;
        }

        const playerId = ctx.socketToPlayer.get(socket.id);
        if (!playerId) {
          ctx.logEvent({ socketId: socket.id, eventType: 'game:distributeTalon', eventData: parsed.data, result: 'rejected', errorMessage: 'Not in room' });
          socket.emit('game:error', { code: 'NOT_IN_ROOM', message: 'You must be in a room' });
          return;
        }

        const room = roomService.getRoomByPlayerId(playerId);
        if (!room || !room.gameId) {
          ctx.logEvent({ socketId: socket.id, eventType: 'game:distributeTalon', eventData: parsed.data, result: 'rejected', errorMessage: 'No active game' });
          socket.emit('game:error', { code: 'NO_GAME', message: 'No active game' });
          return;
        }

        const engine = ctx.gameEngines.get(room.gameId);
        if (!engine) {
          ctx.logEvent({ socketId: socket.id, eventType: 'game:distributeTalon', eventData: parsed.data, result: 'rejected', errorMessage: 'Game engine not found' });
          socket.emit('game:error', { code: 'NO_GAME', message: 'Game engine not found' });
          return;
        }

        ctx.logEvent({ socketId: socket.id, eventType: 'game:distributeTalon', eventData: parsed.data, result: 'success' });
        engine.handleDistributeTalon(playerId, parsed.data);
      } catch (error) {
        console.error('Error distributing talon:', error);
        ctx.logEvent({ socketId: socket.id, eventType: 'game:distributeTalon', eventData: { distribution }, result: 'error', errorMessage: String(error) });
        socket.emit('game:error', { code: 'SERVER_ERROR', message: 'Failed to distribute talon' });
      }
    });
  });

  socket.on('game:playCard', (card) => {
    ctx.withRateLimit(socket, 'game:playCard', () => {
      try {
        const parsed = CardSchema.safeParse(card);
        if (!parsed.success) {
          ctx.logEvent({ socketId: socket.id, eventType: 'game:playCard', eventData: { card }, result: 'rejected', errorMessage: 'Invalid card' });
          socket.emit('game:error', { code: 'INVALID_INPUT', message: 'Invalid card' });
          return;
        }

        const playerId = ctx.socketToPlayer.get(socket.id);
        if (!playerId) {
          ctx.logEvent({ socketId: socket.id, eventType: 'game:playCard', eventData: { card: parsed.data }, result: 'rejected', errorMessage: 'Not in room' });
          socket.emit('game:error', { code: 'NOT_IN_ROOM', message: 'You must be in a room' });
          return;
        }

        const room = roomService.getRoomByPlayerId(playerId);
        if (!room || !room.gameId) {
          ctx.logEvent({ socketId: socket.id, eventType: 'game:playCard', eventData: { card: parsed.data }, result: 'rejected', errorMessage: 'No active game' });
          socket.emit('game:error', { code: 'NO_GAME', message: 'No active game' });
          return;
        }

        const engine = ctx.gameEngines.get(room.gameId);
        if (!engine) {
          ctx.logEvent({ socketId: socket.id, eventType: 'game:playCard', eventData: { card: parsed.data }, result: 'rejected', errorMessage: 'Game engine not found' });
          socket.emit('game:error', { code: 'NO_GAME', message: 'Game engine not found' });
          return;
        }

        // Get player's hand for debugging context
        const game = gameService.getGame(room.gameId);
        const playerHand = game?.currentRound?.players[playerId]?.hand || [];

        ctx.logEvent({
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
        ctx.logEvent({ socketId: socket.id, eventType: 'game:playCard', eventData: { card }, result: 'error', errorMessage: String(error) });
        socket.emit('game:error', { code: 'SERVER_ERROR', message: 'Failed to play card' });
      }
    });
  });

  socket.on('game:declareMarriage', (suit) => {
    ctx.withRateLimit(socket, 'game:declareMarriage', () => {
      try {
        const parsed = SuitSchema.safeParse(suit);
        if (!parsed.success) {
          ctx.logEvent({ socketId: socket.id, eventType: 'game:declareMarriage', eventData: { suit }, result: 'rejected', errorMessage: 'Invalid suit' });
          socket.emit('game:error', { code: 'INVALID_INPUT', message: 'Invalid suit' });
          return;
        }

        const playerId = ctx.socketToPlayer.get(socket.id);
        if (!playerId) {
          ctx.logEvent({ socketId: socket.id, eventType: 'game:declareMarriage', eventData: { suit: parsed.data }, result: 'rejected', errorMessage: 'Not in room' });
          socket.emit('game:error', { code: 'NOT_IN_ROOM', message: 'You must be in a room' });
          return;
        }

        const room = roomService.getRoomByPlayerId(playerId);
        if (!room || !room.gameId) {
          ctx.logEvent({ socketId: socket.id, eventType: 'game:declareMarriage', eventData: { suit: parsed.data }, result: 'rejected', errorMessage: 'No active game' });
          socket.emit('game:error', { code: 'NO_GAME', message: 'No active game' });
          return;
        }

        const engine = ctx.gameEngines.get(room.gameId);
        if (!engine) {
          ctx.logEvent({ socketId: socket.id, eventType: 'game:declareMarriage', eventData: { suit: parsed.data }, result: 'rejected', errorMessage: 'Game engine not found' });
          socket.emit('game:error', { code: 'NO_GAME', message: 'Game engine not found' });
          return;
        }

        ctx.logEvent({ socketId: socket.id, eventType: 'game:declareMarriage', eventData: { suit: parsed.data }, result: 'success' });
        engine.handleDeclareMarriage(playerId, parsed.data);
      } catch (error) {
        console.error('Error declaring marriage:', error);
        ctx.logEvent({ socketId: socket.id, eventType: 'game:declareMarriage', eventData: { suit }, result: 'error', errorMessage: String(error) });
        socket.emit('game:error', { code: 'SERVER_ERROR', message: 'Failed to declare marriage' });
      }
    });
  });

  socket.on('game:leave', () => {
    ctx.withRateLimit(socket, 'game:leave', async () => {
      try {
        const playerId = ctx.socketToPlayer.get(socket.id);
        if (!playerId) {
          socket.emit('game:error', { code: 'NOT_IN_ROOM', message: 'You must be in a room' });
          return;
        }

        const room = roomService.getRoomByPlayerId(playerId);
        if (!room || !room.gameId) {
          socket.emit('game:error', { code: 'NO_GAME', message: 'No active game' });
          return;
        }

        const engine = ctx.gameEngines.get(room.gameId);
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
        ctx.socketToPlayer.delete(socket.id);
        ctx.playerToSocket.delete(playerId);
        await invalidatePlayerSession(playerId);

        // Leave the socket room
        socket.leave(room.id);

        // Notify other players
        ctx.io.to(room.id).emit('game:playerReplacedByAI', { playerId, playerName });

        // Broadcast updated room
        const updatedRoom = roomService.getRoom(room.id);
        if (updatedRoom) {
          ctx.io.to(room.id).emit('room:updated', updatedRoom);
        }

        console.log(`Player ${playerId} left game and was replaced by AI`);
      } catch (error) {
        console.error('Error leaving game:', error);
        socket.emit('game:error', { code: 'SERVER_ERROR', message: 'Failed to leave game' });
      }
    });
  });

  socket.on('game:pause', () => {
    ctx.withRateLimit(socket, 'game:pause', () => {
      try {
        const playerId = ctx.socketToPlayer.get(socket.id);
        if (!playerId) {
          socket.emit('game:error', { code: 'NOT_IN_ROOM', message: 'You must be in a room' });
          return;
        }

        const room = roomService.getRoomByPlayerId(playerId);
        if (!room || !room.gameId) {
          socket.emit('game:error', { code: 'NO_GAME', message: 'No active game' });
          return;
        }

        const engine = ctx.gameEngines.get(room.gameId);
        if (!engine) {
          socket.emit('game:error', { code: 'NO_GAME', message: 'Game engine not found' });
          return;
        }

        const success = engine.pauseGame(playerId);
        if (!success) {
          socket.emit('game:error', { code: 'CANNOT_PAUSE', message: 'Cannot pause game at this time' });
        }
      } catch (error) {
        console.error('Error pausing game:', error);
        socket.emit('game:error', { code: 'SERVER_ERROR', message: 'Failed to pause game' });
      }
    });
  });

  socket.on('game:resume', () => {
    ctx.withRateLimit(socket, 'game:resume', () => {
      try {
        const playerId = ctx.socketToPlayer.get(socket.id);
        if (!playerId) {
          socket.emit('game:error', { code: 'NOT_IN_ROOM', message: 'You must be in a room' });
          return;
        }

        const room = roomService.getRoomByPlayerId(playerId);
        if (!room || !room.gameId) {
          socket.emit('game:error', { code: 'NO_GAME', message: 'No active game' });
          return;
        }

        const engine = ctx.gameEngines.get(room.gameId);
        if (!engine) {
          socket.emit('game:error', { code: 'NO_GAME', message: 'Game engine not found' });
          return;
        }

        const success = engine.resumeGame(playerId);
        if (!success) {
          socket.emit('game:error', { code: 'CANNOT_RESUME', message: 'Cannot resume game - pause may have expired' });
        }
      } catch (error) {
        console.error('Error resuming game:', error);
        socket.emit('game:error', { code: 'SERVER_ERROR', message: 'Failed to resume game' });
      }
    });
  });
}

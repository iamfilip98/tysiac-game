import type { ClientGameState, ValidAction } from '@tysiac/shared';
import type { HandlerContext, TypedSocket } from './handlerContext.js';
import * as roomService from '../services/roomService.js';
import * as gameService from '../services/gameService.js';
import { GameEngine } from '../game/engine.js';
import { getClientGameState } from '../game/stateManager.js';
import { clearRateLimits, releaseIPConnection } from '../security/rateLimit.js';
import { validateSession } from '../security/session.js';
import { ReconnectSchema } from '../validation/schemas.js';
import { persistGame } from '../services/persistenceService.js';

export function registerConnectionHandlers(socket: TypedSocket, ctx: HandlerContext): void {
  // Reconnection with session validation
  socket.on('player:reconnect', (data) => {
    ctx.withRateLimit(socket, 'player:reconnect', () => {
      try {
        const parsed = ReconnectSchema.safeParse(data);
        if (!parsed.success) {
          ctx.logEvent({ socketId: socket.id, eventType: 'player:reconnect', eventData: data, result: 'rejected', errorMessage: 'Invalid reconnect data' });
          socket.emit('room:error', { code: 'INVALID_INPUT', message: 'Invalid reconnect data' });
          return;
        }

        const { roomId, playerId, sessionToken } = parsed.data;

        // Cancel any pending disconnect timeout FIRST to prevent race conditions
        const pendingTimeout = ctx.disconnectTimeouts.get(playerId);
        if (pendingTimeout) {
          clearTimeout(pendingTimeout);
          ctx.disconnectTimeouts.delete(playerId);
        }

        // Cancel any pending AI replacement timer
        const pendingAI = ctx.aiReplacementTimeouts.get(playerId);
        if (pendingAI) {
          clearTimeout(pendingAI);
          ctx.aiReplacementTimeouts.delete(playerId);
        }

        // Validate session token — fall back to auth token if session invalid
        if (!validateSession(sessionToken, playerId)) {
          // If the player is authenticated and the playerId matches, allow reconnect
          if (ctx.authenticatedPlayerId && ctx.authenticatedPlayerId === playerId) {
            // Auth token is valid — create a fresh game session for this connection
            ctx.logEvent({ socketId: socket.id, eventType: 'player:reconnect', eventData: { roomId, playerId }, result: 'success', metadata: { authFallback: true } });
          } else {
            ctx.logEvent({ socketId: socket.id, eventType: 'player:reconnect', eventData: { roomId, playerId }, result: 'rejected', errorMessage: 'Invalid or expired session' });
            socket.emit('room:error', { code: 'INVALID_SESSION', message: 'Invalid or expired session' });
            return;
          }
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

        // Clear old socket mapping if exists
        const oldSocketId = ctx.playerToSocket.get(playerId);
        if (oldSocketId && oldSocketId !== socket.id) {
          ctx.socketToPlayer.delete(oldSocketId);
        }

        // Update mappings
        ctx.socketToPlayer.set(socket.id, playerId);
        ctx.playerToSocket.set(playerId, socket.id);
        socket.join(roomId);

        // Check if the player was replaced by AI and reclaim their seat
        const playerInRoom = room.players.find(p => p.id === playerId);
        if (playerInRoom?.isAI) {
          const playerName = playerInRoom.name.replace(/\s*\[AI\]$/, '');
          roomService.reclaimFromAI(roomId, playerId, playerName);
        }

        // Get game state if exists
        let gameState: ClientGameState | null = null;
        let validActions: ValidAction[] = [];

        if (room.gameId) {
          const game = gameService.getGame(room.gameId);

          if (game) {
            gameState = getClientGameState(game, playerId);

            // Ensure engine exists for future actions
            let engine = ctx.gameEngines.get(room.gameId);
            if (!engine) {
              engine = new GameEngine(
                game,
                ctx.io,
                room.id,
                () => { ctx.cleanupGame(game.id, room.id); ctx.broadcastRoomList(); },
                (pid: string) => ctx.playerToSocket.get(pid) || null,
                true,
                (g) => {
                  const r = roomService.getRoom(g.roomId);
                  if (r) persistGame(g, r);
                },
                room.isPrivate
              );
              ctx.gameEngines.set(room.gameId, engine);

              // After a short delay, resume phase-specific logic (AI turns, timers)
              setTimeout(() => {
                engine!.resumeAfterRestore();
              }, 5000);
            }

            // Reclaim from AI in engine if player was replaced
            if (playerInRoom?.isAI) {
              engine.reclaimFromAI(playerId);
            }

            // Get valid actions from engine state, then notify the player
            validActions = engine.getValidActionsForPlayer(playerId);
            engine.notifyPlayerIfTheirTurn(playerId);

            ctx.logEvent({ socketId: socket.id, eventType: 'player:reconnect', eventData: { roomId, playerId }, result: 'success', metadata: { hasActiveGame: true, phase: game?.phase, reclaimedFromAI: !!playerInRoom?.isAI } });
            socket.emit('connection:restored', { room, gameState, validActions });
            socket.to(roomId).emit('player:reconnected', playerId);
            if (playerInRoom?.isAI) {
              ctx.io.to(roomId).emit('room:updated', room);
            }
            return;
          }
        }

        ctx.logEvent({ socketId: socket.id, eventType: 'player:reconnect', eventData: { roomId, playerId }, result: 'success', metadata: { hasActiveGame: false, reclaimedFromAI: !!playerInRoom?.isAI } });
        socket.emit('connection:restored', { room, gameState, validActions });
        socket.to(roomId).emit('player:reconnected', playerId);
        if (playerInRoom?.isAI) {
          ctx.io.to(roomId).emit('room:updated', room);
        }
      } catch (error) {
        console.error('[RECONNECT] Error:', error);
        ctx.logEvent({ socketId: socket.id, eventType: 'player:reconnect', eventData: data, result: 'error', errorMessage: String(error) });
        socket.emit('room:error', { code: 'SERVER_ERROR', message: 'Failed to reconnect' });
      }
    });
  });

  // Disconnection with grace period
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    ctx.logEvent({ socketId: socket.id, eventType: 'disconnect', result: 'success' });
    clearRateLimits(socket.id);

    // Release IP connection count
    const disconnectIP = ctx.socketToIP.get(socket.id);
    if (disconnectIP) {
      releaseIPConnection(disconnectIP);
      ctx.socketToIP.delete(socket.id);
    }

    ctx.handlePlayerLeave(socket, false);
  });
}

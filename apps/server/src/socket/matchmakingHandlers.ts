import type { HandlerContext, TypedSocket } from './handlerContext.js';
import * as matchmakingService from '../services/matchmakingService.js';
import * as roomService from '../services/roomService.js';
import * as gameService from '../services/gameService.js';
import { GameEngine } from '../game/engine.js';
import { createSession } from '../security/session.js';
import { MatchmakingJoinSchema } from '../validation/schemas.js';
import { persistGame } from '../services/persistenceService.js';

let matchmakingInitialized = false;

/** Call once to wire up the fill-timeout callback. */
export function initMatchmaking(ctx: HandlerContext): void {
  if (matchmakingInitialized) return;
  matchmakingInitialized = true;

  // The fill timer callback fires when 30s elapses without 3 players.
  // We set it up lazily from addToQueue flow — see onFillTimeout below.
  // Store ctx for the timeout callback.
  storedCtx = ctx;
}

let storedCtx: HandlerContext | null = null;

function onFillTimeout(): void {
  if (!storedCtx) return;
  const ctx = storedCtx;

  const remaining = matchmakingService.drainQueue();
  if (remaining.length === 0) return;

  assembleMatch(remaining, ctx);
}

function broadcastQueueStatus(ctx: HandlerContext): void {
  const size = matchmakingService.getQueueSize();
  // Notify all queued players about the current count
  // We need to iterate queue entries — access via getQueueSize is enough
  // since we broadcast to each player as they join. But after removes
  // we need to update remaining players. Use a simpler approach:
  // store socket ids of queued players and emit to each.
  // For simplicity, we can't iterate the queue directly from outside.
  // Instead, we emit to each known queued socket.
  // Actually, let's use the io instance to emit to a "matchmaking" room.
  ctx.io.to('matchmaking-queue').emit('matchmaking:searching', { playersFound: size });
}

async function assembleMatch(players: matchmakingService.QueueEntry[], ctx: HandlerContext): Promise<void> {
  if (players.length === 0) return;

  try {
    const host = players[0];

    // Create a private room (won't show in lobby)
    const room = roomService.createRoom(
      host.playerId,
      host.playerName,
      'Quick Match',
      true, // isPrivate
      3,
    );

    // Join remaining human players
    for (let i = 1; i < players.length; i++) {
      roomService.joinRoom(room.id, players[i].playerId, players[i].playerName);
    }

    // Fill empty slots with AI
    const slotsToFill = 3 - players.length;
    for (let i = 0; i < slotsToFill; i++) {
      roomService.addAI(room.id);
    }

    // Set all human players as ready
    for (const p of players) {
      roomService.setPlayerReady(p.playerId, true);
    }

    // Create sessions and join sockets to the room
    for (const p of players) {
      const sessionToken = await createSession(p.playerId, room.id);
      const socket = ctx.io.sockets.sockets.get(p.socketId);
      if (socket) {
        socket.leave('matchmaking-queue');
        socket.join(room.id);

        const updatedRoom = roomService.getRoom(room.id);
        if (updatedRoom) {
          socket.emit('matchmaking:found', {
            room: updatedRoom,
            playerId: p.playerId,
            sessionToken,
          });
        }
      }
    }

    // Get final room state with AI players included
    const finalRoom = roomService.getRoom(room.id);
    if (!finalRoom) return;

    // Create and start the game (same pattern as roomHandlers.ts room:startGame)
    const gamePlayers = finalRoom.players.map(p => ({ id: p.id, name: p.name, isAI: p.isAI }));
    const game = gameService.createGame(room.id, gamePlayers);
    roomService.setGameId(room.id, game.id);

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
      true, // isPrivate
    );
    ctx.gameEngines.set(game.id, engine);

    engine.startGame();

    // Broadcast updated room
    const updatedRoom = roomService.getRoom(room.id);
    if (updatedRoom) {
      ctx.io.to(room.id).emit('room:updated', updatedRoom);
    }

    console.log(`[Matchmaking] Match assembled: ${players.length} humans + ${slotsToFill} AI, gameId=${game.id}`);
  } catch (error) {
    console.error('[Matchmaking] Error assembling match:', error);
    // Notify players of the error
    for (const p of players) {
      const socket = ctx.io.sockets.sockets.get(p.socketId);
      if (socket) {
        socket.leave('matchmaking-queue');
        socket.emit('matchmaking:error', { code: 'MATCH_FAILED', message: 'Failed to create match. Please try again.' });
      }
    }
  }
}

function checkForMatch(ctx: HandlerContext): void {
  // Try to form a full 3-player match
  const matched = matchmakingService.tryMatch();
  if (matched) {
    matchmakingService.cancelFillTimer();
    assembleMatch(matched, ctx);

    // If there are still players in the queue, restart the fill timer
    if (matchmakingService.getQueueSize() > 0) {
      matchmakingService.startFillTimer(onFillTimeout);
    }
    return;
  }

  // Not enough for a full match — ensure fill timer is running if queue isn't empty
  if (matchmakingService.getQueueSize() > 0 && !matchmakingService.isFillTimerRunning()) {
    matchmakingService.startFillTimer(onFillTimeout);
  }
}

export function registerMatchmakingHandlers(socket: TypedSocket, ctx: HandlerContext): void {
  socket.on('matchmaking:join', (data) => {
    ctx.withRateLimit(socket, 'matchmaking:join', () => {
      try {
        const parsed = MatchmakingJoinSchema.safeParse(data);
        if (!parsed.success) {
          socket.emit('matchmaking:error', { code: 'INVALID_INPUT', message: 'Invalid player name' });
          return;
        }

        const { playerName } = parsed.data;
        const playerId = ctx.authenticatedPlayerId || `player-${socket.id}`;

        // Check if already in a room
        const existingPlayer = ctx.socketToPlayer.get(socket.id);
        if (existingPlayer) {
          const existingRoom = roomService.getRoomByPlayerId(existingPlayer);
          if (existingRoom) {
            socket.emit('matchmaking:error', { code: 'ALREADY_IN_ROOM', message: 'You are already in a room' });
            return;
          }
        }

        // Check if already in queue
        if (matchmakingService.isInQueue(playerId)) {
          socket.emit('matchmaking:error', { code: 'ALREADY_IN_QUEUE', message: 'You are already searching for a match' });
          return;
        }

        // Set up socket-player mapping
        ctx.socketToPlayer.set(socket.id, playerId);
        ctx.playerToSocket.set(playerId, socket.id);

        // Add to queue
        matchmakingService.addToQueue({
          playerId,
          playerName,
          socketId: socket.id,
          joinedAt: Date.now(),
          isRegistered: playerId.startsWith('user_'),
        });

        // Join the matchmaking socket room for broadcasts
        socket.join('matchmaking-queue');

        ctx.logEvent({ socketId: socket.id, eventType: 'matchmaking:join', eventData: { playerName }, result: 'success', metadata: { queueSize: matchmakingService.getQueueSize() } });

        // Broadcast updated queue size to all searching players
        broadcastQueueStatus(ctx);

        // Check if we can form a match
        checkForMatch(ctx);
      } catch (error) {
        console.error('[Matchmaking] Error joining queue:', error);
        socket.emit('matchmaking:error', { code: 'SERVER_ERROR', message: 'Failed to join matchmaking' });
      }
    });
  });

  socket.on('matchmaking:leave', () => {
    ctx.withRateLimit(socket, 'matchmaking:leave', () => {
      try {
        const playerId = ctx.socketToPlayer.get(socket.id);
        if (!playerId) return;

        const removed = matchmakingService.removeFromQueue(playerId);
        if (removed) {
          socket.leave('matchmaking-queue');
          ctx.logEvent({ socketId: socket.id, eventType: 'matchmaking:leave', result: 'success', metadata: { queueSize: matchmakingService.getQueueSize() } });

          // Clean up socket mappings (player isn't in a room)
          ctx.socketToPlayer.delete(socket.id);
          ctx.playerToSocket.delete(playerId);

          // If queue is now empty, cancel the fill timer
          if (matchmakingService.getQueueSize() === 0) {
            matchmakingService.cancelFillTimer();
          } else {
            broadcastQueueStatus(ctx);
          }
        }
      } catch (error) {
        console.error('[Matchmaking] Error leaving queue:', error);
      }
    });
  });
}

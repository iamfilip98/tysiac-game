import type { HandlerContext, TypedSocket } from './handlerContext.js';
import * as roomService from '../services/roomService.js';

const ALLOWED_EMOTES = new Set(['thumbsup', 'haha', 'wow', 'oops', 'gg', 'hmm']);

// Simple per-player rate limit: 1 emote per second
const lastEmoteTime = new Map<string, number>();
const EMOTE_COOLDOWN_MS = 1000;

export function registerEmoteHandlers(socket: TypedSocket, ctx: HandlerContext): void {
  socket.on('game:emote', (emoteId) => {
    console.log(`[Emote] Received game:emote event: emoteId=${emoteId}, socketId=${socket.id}`);

    const playerId = ctx.socketToPlayer.get(socket.id);
    if (!playerId) {
      console.log(`[Emote] DROPPED: no playerId for socket ${socket.id}`);
      return;
    }

    if (typeof emoteId !== 'string' || !ALLOWED_EMOTES.has(emoteId)) {
      console.log(`[Emote] DROPPED: invalid emoteId '${emoteId}'`);
      return;
    }

    const room = roomService.getRoomByPlayerId(playerId);
    if (!room) {
      console.log(`[Emote] DROPPED: no room for player ${playerId}`);
      return;
    }

    // Rate limit
    const now = Date.now();
    const last = lastEmoteTime.get(playerId) || 0;
    if (now - last < EMOTE_COOLDOWN_MS) {
      console.log(`[Emote] DROPPED: rate limited (${now - last}ms since last)`);
      return;
    }
    lastEmoteTime.set(playerId, now);

    // Broadcast to others in the room (sender shows own emote locally)
    ctx.io.in(room.id).fetchSockets().then(sockets => {
      const socketIds = sockets.map(s => s.id);
      console.log(`[Emote] Broadcasting '${emoteId}' from ${playerId} to room ${room.id} (${room.players.length} players, ${socketIds.length} sockets: ${socketIds.join(', ')})`);
    });
    socket.to(room.id).emit('game:emoteReceived', { playerId, emoteId });
  });
}

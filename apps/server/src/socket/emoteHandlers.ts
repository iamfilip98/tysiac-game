import type { HandlerContext, TypedSocket } from './handlerContext.js';
import * as roomService from '../services/roomService.js';

const ALLOWED_EMOTES = new Set(['thumbsup', 'haha', 'wow', 'oops', 'gg', 'hmm']);

// Simple per-player rate limit: 1 emote per second
const lastEmoteTime = new Map<string, number>();
const EMOTE_COOLDOWN_MS = 1000;

export function registerEmoteHandlers(socket: TypedSocket, ctx: HandlerContext): void {
  socket.on('game:emote', (emoteId) => {
    const playerId = ctx.socketToPlayer.get(socket.id);
    if (!playerId) return;

    if (typeof emoteId !== 'string' || !ALLOWED_EMOTES.has(emoteId)) return;

    const room = roomService.getRoomByPlayerId(playerId);
    if (!room) return;

    // Rate limit
    const now = Date.now();
    const last = lastEmoteTime.get(playerId) || 0;
    if (now - last < EMOTE_COOLDOWN_MS) return;
    lastEmoteTime.set(playerId, now);

    // Broadcast to others in the room (sender shows own emote locally)
    console.log(`[Emote] Broadcasting emote '${emoteId}' from ${playerId} to room ${room.id}`);
    socket.to(room.id).emit('game:emoteReceived', { playerId, emoteId });
  });
}

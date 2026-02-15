import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';
import type { GameState, Room } from '@tysiac/shared';

// Throttle tracking: gameId -> last persist timestamp
const lastPersistTime = new Map<string, number>();
const THROTTLE_MS = 1000;

/**
 * Initialize persistence: create active_games table if it doesn't exist.
 */
export async function initPersistence(): Promise<void> {
  if (!db) {
    console.log('[Persistence] No database, game state persistence disabled');
    return;
  }

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS active_games (
        game_id text PRIMARY KEY,
        game_state jsonb NOT NULL,
        room_state jsonb NOT NULL,
        phase text NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
    console.log('[Persistence] Ensured active_games table exists');
  } catch (error) {
    console.error('[Persistence] Failed to create active_games table:', error);
  }
}

/**
 * Persist game + room state to database. Fire-and-forget with throttling.
 */
export function persistGame(game: GameState, room: Room): void {
  if (!db) return;

  // Throttle: skip if last write was < 1s ago for this game
  const now = Date.now();
  const lastTime = lastPersistTime.get(game.id);
  if (lastTime && now - lastTime < THROTTLE_MS) return;
  lastPersistTime.set(game.id, now);

  // Fire-and-forget upsert
  db.execute(sql`
    INSERT INTO active_games (game_id, game_state, room_state, phase, updated_at)
    VALUES (${game.id}, ${JSON.stringify(game)}::jsonb, ${JSON.stringify(room)}::jsonb, ${game.phase}, now())
    ON CONFLICT (game_id) DO UPDATE SET
      game_state = ${JSON.stringify(game)}::jsonb,
      room_state = ${JSON.stringify(room)}::jsonb,
      phase = ${game.phase},
      updated_at = now()
  `).catch((error) => {
    console.error('[Persistence] Failed to persist game:', error);
  });
}

/**
 * Load all active games from database. Filters out stale entries (>1 hour old).
 */
export async function loadActiveGames(): Promise<Array<{ gameState: GameState; roomState: Room }>> {
  if (!db) return [];

  try {
    const rows = await db.execute(sql`
      SELECT game_state, room_state FROM active_games
      WHERE updated_at > now() - interval '1 hour'
    `);

    const results: Array<{ gameState: GameState; roomState: Room }> = [];
    for (const row of rows) {
      try {
        const gameState = row.game_state as GameState;
        const roomState = row.room_state as Room;

        // Skip games in terminal phases
        if (gameState.phase === 'gameEnd' || gameState.phase === 'idle') continue;

        results.push({ gameState, roomState });
      } catch (err) {
        console.error('[Persistence] Failed to parse game row:', err);
      }
    }

    // Clean up stale entries
    await db.execute(sql`
      DELETE FROM active_games WHERE updated_at <= now() - interval '1 hour'
    `).catch(() => {});

    return results;
  } catch (error) {
    console.error('[Persistence] Failed to load active games:', error);
    return [];
  }
}

/**
 * Remove a persisted game (called on game end/cleanup).
 */
export function removePersistedGame(gameId: string): void {
  if (!db) return;

  lastPersistTime.delete(gameId);

  db.execute(sql`
    DELETE FROM active_games WHERE game_id = ${gameId}
  `).catch((error) => {
    console.error('[Persistence] Failed to remove persisted game:', error);
  });
}

/**
 * Flush all active games to database. Called on SIGTERM for graceful shutdown.
 */
export async function flushAllGames(
  gameGetter: () => GameState[],
  roomGetter: (roomId: string) => Room | undefined
): Promise<void> {
  if (!db) return;

  const games = gameGetter();
  let flushed = 0;

  for (const game of games) {
    // Only persist active games (not ended/idle)
    if (game.phase === 'gameEnd' || game.phase === 'idle') continue;

    const room = roomGetter(game.roomId);
    if (!room) continue;

    try {
      // Bypass throttle for shutdown flush
      await db.execute(sql`
        INSERT INTO active_games (game_id, game_state, room_state, phase, updated_at)
        VALUES (${game.id}, ${JSON.stringify(game)}::jsonb, ${JSON.stringify(room)}::jsonb, ${game.phase}, now())
        ON CONFLICT (game_id) DO UPDATE SET
          game_state = ${JSON.stringify(game)}::jsonb,
          room_state = ${JSON.stringify(room)}::jsonb,
          phase = ${game.phase},
          updated_at = now()
      `);
      flushed++;
    } catch (error) {
      console.error(`[Persistence] Failed to flush game ${game.id}:`, error);
    }
  }

  if (flushed > 0) {
    console.log(`[Persistence] Flushed ${flushed} active game(s) to database`);
  }
}

import { db, playerStats, players, gameScores } from '../db/index.js';
import { eq, sql } from 'drizzle-orm';

interface PlayerStatsCache {
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  totalBidsWon: number;
  totalBidsFailed: number;
  totalMarriages: number;
  highestGameScore: number;
  currentWinStreak: number;
  longestWinStreak: number;
  rating: number;
}

interface GameResult {
  playerId: string;
  finalScore: number;
  isWinner: boolean;
  bidsWon: number;
  bidsFailed: number;
  marriages: number;
}

// In-memory cache for registered player stats
const statsCache = new Map<string, PlayerStatsCache>();

export async function initializeStats(): Promise<void> {
  if (!db) {
    console.log('[Stats] No database, stats service using in-memory only');
    return;
  }

  try {
    const rows = await db.select().from(playerStats);
    for (const row of rows) {
      statsCache.set(row.playerId, {
        gamesPlayed: row.gamesPlayed,
        gamesWon: row.gamesWon,
        gamesLost: row.gamesLost,
        totalBidsWon: row.totalBidsWon,
        totalBidsFailed: row.totalBidsFailed,
        totalMarriages: row.totalMarriages,
        highestGameScore: row.highestGameScore,
        currentWinStreak: row.currentWinStreak,
        longestWinStreak: row.longestWinStreak,
        rating: row.rating,
      });
    }
    console.log(`[Stats] Loaded stats for ${rows.length} registered players`);
  } catch (error) {
    console.error('[Stats] Failed to load stats:', error);
  }
}

export function getStats(playerId: string): PlayerStatsCache | null {
  return statsCache.get(playerId) || null;
}

export async function updateStatsAfterGame(
  gameId: string,
  roomId: string,
  results: GameResult[],
  roundScores: Record<string, number[]>
): Promise<void> {
  for (const result of results) {
    // Only track stats for registered users (Clerk user_* prefix)
    if (!result.playerId.startsWith('user_')) continue;

    let stats = statsCache.get(result.playerId);
    if (!stats) {
      stats = {
        gamesPlayed: 0, gamesWon: 0, gamesLost: 0,
        totalBidsWon: 0, totalBidsFailed: 0, totalMarriages: 0,
        highestGameScore: 0, currentWinStreak: 0, longestWinStreak: 0,
        rating: 1000,
      };
    }

    stats.gamesPlayed++;
    stats.totalBidsWon += result.bidsWon;
    stats.totalBidsFailed += result.bidsFailed;
    stats.totalMarriages += result.marriages;

    if (result.finalScore > stats.highestGameScore) {
      stats.highestGameScore = result.finalScore;
    }

    if (result.isWinner) {
      stats.gamesWon++;
      stats.currentWinStreak++;
      if (stats.currentWinStreak > stats.longestWinStreak) {
        stats.longestWinStreak = stats.currentWinStreak;
      }
      stats.rating += 25;
    } else {
      stats.gamesLost++;
      stats.currentWinStreak = 0;
      stats.rating = Math.max(100, stats.rating - 15);
    }

    statsCache.set(result.playerId, stats);

    // Persist to database (fire-and-forget)
    if (db) {
      db.update(playerStats)
        .set({
          gamesPlayed: stats.gamesPlayed,
          gamesWon: stats.gamesWon,
          gamesLost: stats.gamesLost,
          totalBidsWon: stats.totalBidsWon,
          totalBidsFailed: stats.totalBidsFailed,
          totalMarriages: stats.totalMarriages,
          highestGameScore: stats.highestGameScore,
          currentWinStreak: stats.currentWinStreak,
          longestWinStreak: stats.longestWinStreak,
          rating: stats.rating,
          updatedAt: new Date(),
        })
        .where(eq(playerStats.playerId, result.playerId))
        .catch((error) => {
          console.error(`[Stats] Failed to persist stats for ${result.playerId}:`, error);
        });
    }
  }

  // Persist game scores to DB (fire-and-forget)
  if (db) {
    for (const result of results) {
      const playerRoundScores = roundScores[result.playerId] || [];
      db.insert(gameScores).values({
        gameId,
        playerId: result.playerId,
        finalScore: result.finalScore,
        roundScores: playerRoundScores,
        isWinner: result.isWinner,
      }).onConflictDoNothing()
        .catch((error) => {
          console.error(`[Stats] Failed to persist game score for ${result.playerId}:`, error);
        });
    }
  }
}

/**
 * Ensure a Clerk user has a player + playerStats row in the database.
 * Called fire-and-forget on socket connection for authenticated users.
 */
export async function ensureClerkPlayer(clerkUserId: string): Promise<void> {
  if (!db) return;

  try {
    // Check if player already exists
    const existing = await db.select({ id: players.id })
      .from(players)
      .where(eq(players.clerkId, clerkUserId))
      .limit(1);

    if (existing.length > 0) return;

    // Create player row (use clerkUserId as the player ID for consistency)
    const now = new Date();
    await db.insert(players).values({
      id: clerkUserId,
      name: clerkUserId, // Will be overridden by display name from client
      clerkId: clerkUserId,
      isRegistered: true,
      createdAt: now,
      lastSeen: now,
    }).onConflictDoNothing();

    // Create empty stats row
    await db.insert(playerStats).values({
      playerId: clerkUserId,
      updatedAt: now,
    }).onConflictDoNothing();

    console.log(`[Stats] Created player + stats for Clerk user ${clerkUserId}`);
  } catch (error) {
    console.error(`[Stats] Failed to ensure Clerk player ${clerkUserId}:`, error);
  }
}

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { db, authTokens, players, playerStats } from '../db/index.js';
import { eq, lt, sql } from 'drizzle-orm';
import { z } from 'zod';

// --- Types ---

interface AuthTokenEntry {
  token: string;
  playerId: string;
  createdAt: number;
  lastActivity: number;
  expiresAt: number;
}

interface PlayerProfile {
  playerId: string;
  displayName: string;
  email: string;
  isRegistered: boolean;
  stats: PlayerStatsData;
}

interface PlayerStatsData {
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

// --- In-memory storage ---

const tokenMap = new Map<string, AuthTokenEntry>();
const playerTokens = new Map<string, string>(); // playerId -> token

const AUTH_TOKEN_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
const BCRYPT_ROUNDS = 12;

let cleanupInterval: NodeJS.Timeout | null = null;

// --- Validation schemas ---

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const playerNameRegex = /^[a-zA-Z0-9\s\-_ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+$/;

export const RegisterSchema = z.object({
  email: z.string().min(1).max(254).trim().toLowerCase().regex(emailRegex, 'Invalid email address'),
  password: z.string().min(6).max(128),
  displayName: z.string().min(1).max(20).trim().regex(playerNameRegex, 'Display name contains invalid characters'),
});

export const LoginSchema = z.object({
  email: z.string().min(1).max(254).trim().toLowerCase(),
  password: z.string().min(1).max(128),
});

// --- Initialization ---

export async function initializeAuth(): Promise<void> {
  if (!db) {
    console.log('[Auth] No database, auth features limited to in-memory');
    return;
  }

  try {
    // Ensure auth_tokens table exists
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS auth_tokens (
        token text PRIMARY KEY NOT NULL,
        player_id text NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        created_at timestamp DEFAULT now() NOT NULL,
        last_activity timestamp DEFAULT now() NOT NULL,
        expires_at timestamp NOT NULL
      )
    `);

    // Ensure player_stats table exists
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS player_stats (
        player_id text PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
        games_played integer DEFAULT 0 NOT NULL,
        games_won integer DEFAULT 0 NOT NULL,
        games_lost integer DEFAULT 0 NOT NULL,
        total_bids_won integer DEFAULT 0 NOT NULL,
        total_bids_failed integer DEFAULT 0 NOT NULL,
        total_marriages integer DEFAULT 0 NOT NULL,
        highest_game_score integer DEFAULT 0 NOT NULL,
        current_win_streak integer DEFAULT 0 NOT NULL,
        longest_win_streak integer DEFAULT 0 NOT NULL,
        rating integer DEFAULT 1000 NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);

    // Add columns to players table if they don't exist
    await db.execute(sql`
      ALTER TABLE players ADD COLUMN IF NOT EXISTS email text UNIQUE
    `);
    await db.execute(sql`
      ALTER TABLE players ADD COLUMN IF NOT EXISTS password_hash text
    `);
    await db.execute(sql`
      ALTER TABLE players ADD COLUMN IF NOT EXISTS is_registered boolean DEFAULT false NOT NULL
    `);

    console.log('[Auth] Ensured auth tables and columns exist');

    // Clean up expired tokens first
    const now = new Date();
    await db.delete(authTokens).where(lt(authTokens.expiresAt, now));

    // Load active tokens into memory
    const dbTokens = await db.select().from(authTokens);
    for (const t of dbTokens) {
      const entry: AuthTokenEntry = {
        token: t.token,
        playerId: t.playerId,
        createdAt: t.createdAt.getTime(),
        lastActivity: t.lastActivity.getTime(),
        expiresAt: t.expiresAt.getTime(),
      };
      tokenMap.set(t.token, entry);
      playerTokens.set(t.playerId, t.token);
    }

    console.log(`[Auth] Loaded ${dbTokens.length} auth tokens from database`);
  } catch (error) {
    console.error('[Auth] Failed to initialize:', error);
  }
}

// --- Token helpers ---

function generateAuthToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

async function createAuthToken(playerId: string): Promise<string> {
  // Invalidate existing token for this player
  const existingToken = playerTokens.get(playerId);
  if (existingToken) {
    tokenMap.delete(existingToken);
    playerTokens.delete(playerId);
  }

  const token = generateAuthToken();
  const now = Date.now();
  const expiresAt = now + AUTH_TOKEN_TTL;

  const entry: AuthTokenEntry = {
    token,
    playerId,
    createdAt: now,
    lastActivity: now,
    expiresAt,
  };

  tokenMap.set(token, entry);
  playerTokens.set(playerId, token);

  // Persist to database (fire-and-forget)
  if (db) {
    db.insert(authTokens).values({
      token,
      playerId,
      createdAt: new Date(now),
      lastActivity: new Date(now),
      expiresAt: new Date(expiresAt),
    }).catch((error) => {
      console.error('[Auth] Failed to persist auth token:', error);
    });
  }

  return token;
}

// --- Public API ---

export async function registerPlayer(
  email: string,
  password: string,
  displayName: string
): Promise<{ playerId: string; authToken: string; displayName: string }> {
  // Check for existing email
  if (db) {
    const existing = await db.select({ id: players.id })
      .from(players)
      .where(eq(players.email, email.toLowerCase()))
      .limit(1);
    if (existing.length > 0) {
      throw new Error('Email already registered');
    }
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const playerId = `user-${nanoid()}`;
  const now = new Date();

  // Insert player
  if (db) {
    await db.insert(players).values({
      id: playerId,
      name: displayName,
      email: email.toLowerCase(),
      passwordHash,
      isRegistered: true,
      createdAt: now,
      lastSeen: now,
    });

    // Insert empty stats row
    await db.insert(playerStats).values({
      playerId,
      updatedAt: now,
    });
  }

  const authToken = await createAuthToken(playerId);

  return { playerId, authToken, displayName };
}

export async function loginPlayer(
  email: string,
  password: string
): Promise<{ playerId: string; authToken: string; displayName: string }> {
  if (!db) {
    throw new Error('Database required for login');
  }

  const result = await db.select({
    id: players.id,
    name: players.name,
    passwordHash: players.passwordHash,
  })
    .from(players)
    .where(eq(players.email, email.toLowerCase()))
    .limit(1);

  if (result.length === 0 || !result[0].passwordHash) {
    throw new Error('Invalid email or password');
  }

  const player = result[0];
  const valid = await bcrypt.compare(password, player.passwordHash!);
  if (!valid) {
    throw new Error('Invalid email or password');
  }

  // Update last seen
  db.update(players)
    .set({ lastSeen: new Date() })
    .where(eq(players.id, player.id))
    .catch(() => {});

  const authToken = await createAuthToken(player.id);

  return { playerId: player.id, authToken, displayName: player.name };
}

export function validateAuthToken(token: string): { playerId: string } | null {
  const entry = tokenMap.get(token);
  if (!entry) return null;

  const now = Date.now();
  if (now > entry.expiresAt) {
    // Expired — remove from memory
    tokenMap.delete(token);
    playerTokens.delete(entry.playerId);
    return null;
  }

  // Update last activity in memory
  entry.lastActivity = now;

  // Update in database (fire-and-forget)
  if (db) {
    db.update(authTokens)
      .set({ lastActivity: new Date(now) })
      .where(eq(authTokens.token, token))
      .catch(() => {});
  }

  return { playerId: entry.playerId };
}

export async function invalidateAuthToken(token: string): Promise<void> {
  const entry = tokenMap.get(token);
  if (entry) {
    playerTokens.delete(entry.playerId);
    tokenMap.delete(token);

    if (db) {
      try {
        await db.delete(authTokens).where(eq(authTokens.token, token));
      } catch (error) {
        console.error('[Auth] Failed to delete auth token from database:', error);
      }
    }
  }
}

export async function getPlayerProfile(playerId: string): Promise<PlayerProfile | null> {
  if (!db) return null;

  try {
    const result = await db.select({
      id: players.id,
      name: players.name,
      email: players.email,
      isRegistered: players.isRegistered,
    })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    if (result.length === 0) return null;

    const player = result[0];

    // Get stats
    const statsResult = await db.select()
      .from(playerStats)
      .where(eq(playerStats.playerId, playerId))
      .limit(1);

    const stats: PlayerStatsData = statsResult.length > 0 ? {
      gamesPlayed: statsResult[0].gamesPlayed,
      gamesWon: statsResult[0].gamesWon,
      gamesLost: statsResult[0].gamesLost,
      totalBidsWon: statsResult[0].totalBidsWon,
      totalBidsFailed: statsResult[0].totalBidsFailed,
      totalMarriages: statsResult[0].totalMarriages,
      highestGameScore: statsResult[0].highestGameScore,
      currentWinStreak: statsResult[0].currentWinStreak,
      longestWinStreak: statsResult[0].longestWinStreak,
      rating: statsResult[0].rating,
    } : {
      gamesPlayed: 0, gamesWon: 0, gamesLost: 0,
      totalBidsWon: 0, totalBidsFailed: 0, totalMarriages: 0,
      highestGameScore: 0, currentWinStreak: 0, longestWinStreak: 0,
      rating: 1000,
    };

    return {
      playerId: player.id,
      displayName: player.name,
      email: player.email || '',
      isRegistered: player.isRegistered,
      stats,
    };
  } catch (error) {
    console.error('[Auth] Failed to get player profile:', error);
    return null;
  }
}

// --- Cleanup ---

export async function cleanupExpiredAuthTokens(): Promise<void> {
  const now = Date.now();

  // Clean memory
  for (const [token, entry] of tokenMap) {
    if (now > entry.expiresAt) {
      playerTokens.delete(entry.playerId);
      tokenMap.delete(token);
    }
  }

  // Clean database
  if (db) {
    try {
      await db.delete(authTokens).where(lt(authTokens.expiresAt, new Date(now)));
    } catch (error) {
      console.error('[Auth] Failed to cleanup expired tokens from database:', error);
    }
  }
}

export function startAuthCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
  cleanupInterval = setInterval(cleanupExpiredAuthTokens, 60 * 60 * 1000); // hourly
  console.log('[Auth] Started periodic token cleanup');
}

export function stopAuthCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('[Auth] Stopped periodic token cleanup');
  }
}

import crypto from 'crypto';
import { db, sessions } from '../db/index.js';
import { eq, lt, sql } from 'drizzle-orm';

interface Session {
  playerId: string;
  roomId: string;
  token: string;
  createdAt: number;
  lastActivity: number;
}

// In-memory session storage (fallback when DB unavailable)
const sessionMap = new Map<string, Session>();
const playerToSession = new Map<string, string>();

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

let cleanupInterval: NodeJS.Timeout | null = null;

// Initialize sessions from database on startup
export async function initializeSessions(): Promise<void> {
  if (!db) {
    console.log('[Sessions] No database, using in-memory sessions only');
    return;
  }

  try {
    // Create sessions table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sessions (
        token text PRIMARY KEY NOT NULL,
        player_id text NOT NULL UNIQUE,
        room_id text NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        last_activity timestamp DEFAULT now() NOT NULL
      )
    `);
    console.log('[Sessions] Ensured sessions table exists');

    // Clean up expired sessions first
    const expirationTime = new Date(Date.now() - SESSION_TIMEOUT);
    await db.delete(sessions).where(lt(sessions.lastActivity, expirationTime));

    // Load active sessions into memory
    const dbSessions = await db.select().from(sessions);

    for (const s of dbSessions) {
      const session: Session = {
        token: s.token,
        playerId: s.playerId,
        roomId: s.roomId,
        createdAt: s.createdAt.getTime(),
        lastActivity: s.lastActivity.getTime(),
      };
      sessionMap.set(s.token, session);
      playerToSession.set(s.playerId, s.token);
    }

    console.log(`[Sessions] Loaded ${dbSessions.length} sessions from database`);
  } catch (error) {
    console.error('[Sessions] Failed to load sessions from database:', error);
  }
}

export async function createSession(playerId: string, roomId: string): Promise<string> {
  // Invalidate existing session for this player
  const existingToken = playerToSession.get(playerId);
  if (existingToken) {
    sessionMap.delete(existingToken);
    playerToSession.delete(playerId);
  }

  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();

  const session: Session = {
    playerId,
    roomId,
    token,
    createdAt: now,
    lastActivity: now,
  };

  sessionMap.set(token, session);
  playerToSession.set(playerId, token);

  // Persist to database (fire-and-forget with conflict handling)
  if (db) {
    try {
      await db.insert(sessions).values({
        token,
        playerId,
        roomId,
        createdAt: new Date(now),
        lastActivity: new Date(now),
      }).onConflictDoUpdate({
        target: sessions.playerId,
        set: {
          token,
          roomId,
          lastActivity: new Date(now),
        },
      });
    } catch (error) {
      console.error('[Sessions] Failed to persist session to database:', error);
    }
  }

  return token;
}

export function validateSession(token: string, playerId: string): boolean {
  const session = sessionMap.get(token);
  if (!session) return false;
  if (session.playerId !== playerId) return false;

  const now = Date.now();
  if (now - session.lastActivity > SESSION_TIMEOUT) {
    invalidateSession(token);
    return false;
  }

  // Update activity in memory
  session.lastActivity = now;

  // Update activity in database (fire-and-forget)
  if (db) {
    db.update(sessions)
      .set({ lastActivity: new Date(now) })
      .where(eq(sessions.token, token))
      .catch((error) => {
        console.error('[Sessions] Failed to update session activity:', error);
      });
  }

  return true;
}

export function getSessionByPlayer(playerId: string): Session | null {
  const token = playerToSession.get(playerId);
  if (!token) return null;
  return sessionMap.get(token) || null;
}

export function getSessionToken(playerId: string): string | null {
  return playerToSession.get(playerId) || null;
}

export async function invalidateSession(token: string): Promise<void> {
  const session = sessionMap.get(token);
  if (session) {
    playerToSession.delete(session.playerId);
    sessionMap.delete(token);

    // Delete from database
    if (db) {
      try {
        await db.delete(sessions).where(eq(sessions.token, token));
      } catch (error) {
        console.error('[Sessions] Failed to delete session from database:', error);
      }
    }
  }
}

export async function invalidatePlayerSession(playerId: string): Promise<void> {
  const token = playerToSession.get(playerId);
  if (token) {
    sessionMap.delete(token);
    playerToSession.delete(playerId);

    // Delete from database
    if (db) {
      try {
        await db.delete(sessions).where(eq(sessions.playerId, playerId));
      } catch (error) {
        console.error('[Sessions] Failed to delete player session from database:', error);
      }
    }
  }
}

export function refreshSession(playerId: string): void {
  const token = playerToSession.get(playerId);
  if (token) {
    const session = sessionMap.get(token);
    if (session) {
      const now = Date.now();
      session.lastActivity = now;

      // Update in database (fire-and-forget)
      if (db) {
        db.update(sessions)
          .set({ lastActivity: new Date(now) })
          .where(eq(sessions.token, token))
          .catch((error) => {
            console.error('[Sessions] Failed to refresh session in database:', error);
          });
      }
    }
  }
}

// Cleanup expired sessions from both memory and database
export async function cleanupExpiredSessions(): Promise<void> {
  const now = Date.now();

  // Clean memory
  for (const [token, session] of sessionMap) {
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      playerToSession.delete(session.playerId);
      sessionMap.delete(token);
    }
  }

  // Clean database
  if (db) {
    try {
      const expirationTime = new Date(now - SESSION_TIMEOUT);
      await db.delete(sessions).where(lt(sessions.lastActivity, expirationTime));
    } catch (error) {
      console.error('[Sessions] Failed to cleanup expired sessions from database:', error);
    }
  }
}

// Start periodic cleanup (every 5 minutes)
export function startSessionCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
  cleanupInterval = setInterval(cleanupExpiredSessions, 5 * 60 * 1000);
  console.log('[Sessions] Started periodic cleanup');
}

// Stop periodic cleanup
export function stopSessionCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('[Sessions] Stopped periodic cleanup');
  }
}

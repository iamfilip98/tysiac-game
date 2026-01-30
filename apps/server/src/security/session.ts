import crypto from 'crypto';

interface Session {
  playerId: string;
  roomId: string;
  token: string;
  createdAt: number;
  lastActivity: number;
}

// Session storage
const sessions = new Map<string, Session>();
const playerToSession = new Map<string, string>();

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export function createSession(playerId: string, roomId: string): string {
  // Invalidate existing session for this player
  const existingToken = playerToSession.get(playerId);
  if (existingToken) {
    sessions.delete(existingToken);
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

  sessions.set(token, session);
  playerToSession.set(playerId, token);

  return token;
}

export function validateSession(token: string, playerId: string): boolean {
  const session = sessions.get(token);
  if (!session) return false;
  if (session.playerId !== playerId) return false;

  const now = Date.now();
  if (now - session.lastActivity > SESSION_TIMEOUT) {
    invalidateSession(token);
    return false;
  }

  // Update activity
  session.lastActivity = now;
  return true;
}

export function getSessionByPlayer(playerId: string): Session | null {
  const token = playerToSession.get(playerId);
  if (!token) return null;
  return sessions.get(token) || null;
}

export function getSessionToken(playerId: string): string | null {
  return playerToSession.get(playerId) || null;
}

export function invalidateSession(token: string): void {
  const session = sessions.get(token);
  if (session) {
    playerToSession.delete(session.playerId);
    sessions.delete(token);
  }
}

export function invalidatePlayerSession(playerId: string): void {
  const token = playerToSession.get(playerId);
  if (token) {
    sessions.delete(token);
    playerToSession.delete(playerId);
  }
}

export function refreshSession(playerId: string): void {
  const token = playerToSession.get(playerId);
  if (token) {
    const session = sessions.get(token);
    if (session) {
      session.lastActivity = Date.now();
    }
  }
}

// Cleanup expired sessions periodically
export function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      playerToSession.delete(session.playerId);
      sessions.delete(token);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredSessions, 5 * 60 * 1000);

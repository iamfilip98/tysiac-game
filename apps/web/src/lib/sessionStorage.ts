import type { StoredSession } from '@tysiac/game-logic';

export type { StoredSession } from '@tysiac/game-logic';

const SESSION_KEY = 'tysiac_session';
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export function saveSession(session: Omit<StoredSession, 'timestamp'>): void {
  try {
    const stored: StoredSession = {
      ...session,
      timestamp: Date.now(),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(stored));
  } catch {
    // Silently swallow - localStorage may be unavailable
  }
}

export function loadSession(): StoredSession | null {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) return null;

    const session = JSON.parse(stored) as StoredSession;

    // Check if session is stale (older than 30 minutes)
    if (Date.now() - session.timestamp > SESSION_TIMEOUT) {
      clearSession();
      return null;
    }

    return session;
  } catch {
    // Silently swallow - localStorage may be unavailable
    return null;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (e) {
    // Ignore
  }
}

export function updateSessionTimestamp(): void {
  const session = loadSession();
  if (session) {
    saveSession(session);
  }
}

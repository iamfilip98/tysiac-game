import type { StoredSession, StorageAdapter } from './types.js';

const SESSION_KEY = 'tysiac_session';
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export interface SessionManager {
  save(session: Omit<StoredSession, 'timestamp'>): Promise<void>;
  load(): Promise<StoredSession | null>;
  clear(): Promise<void>;
  updateTimestamp(): Promise<void>;
}

export function createSessionManager(adapter: StorageAdapter): SessionManager {
  return {
    async save(session) {
      const stored: StoredSession = {
        ...session,
        timestamp: Date.now(),
      };
      await adapter.setItem(SESSION_KEY, JSON.stringify(stored));
    },

    async load() {
      const raw = await adapter.getItem(SESSION_KEY);
      if (!raw) return null;

      const session = JSON.parse(raw) as StoredSession;

      if (Date.now() - session.timestamp > SESSION_TIMEOUT) {
        await adapter.removeItem(SESSION_KEY);
        return null;
      }

      return session;
    },

    async clear() {
      await adapter.removeItem(SESSION_KEY);
    },

    async updateTimestamp() {
      const session = await this.load();
      if (session) {
        await this.save(session);
      }
    },
  };
}

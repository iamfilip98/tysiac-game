import type { StorageAdapter } from './types.js';

/** localStorage adapter for web — wraps sync API as async */
export const localStorageAdapter: StorageAdapter = {
  async getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Silently swallow — localStorage may be unavailable
    }
  },
  async removeItem(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Silently swallow
    }
  },
};

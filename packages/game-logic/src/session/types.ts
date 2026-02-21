export interface StoredSession {
  playerId: string;
  roomId: string;
  sessionToken: string;
  playerName: string;
  timestamp: number;
}

/** Platform-agnostic storage adapter (async-first for React Native compatibility) */
export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

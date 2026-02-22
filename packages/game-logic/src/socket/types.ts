import type { Card, Suit, ValidAction, Room, ClientGameState, RoundResult, GameStatistics } from '@tysiac/shared';
import type { StoredSession } from '../session/types.js';

/** Minimal socket interface — satisfied by socket.io-client or any RN socket lib.
 *  Handler args use `any` because each event has a different payload shape;
 *  the actual types are enforced inside registerSocketListeners via casts. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface SocketLike {
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string): void;
  emit(event: string, ...args: any[]): void;
  connected: boolean;
}

/** Platform-agnostic sound playback */
export interface SoundAdapter {
  play(name: string): void;
}

/** Synchronous session persistence (web: localStorage wrapper) */
export interface SyncSessionAdapter {
  save(session: Omit<StoredSession, 'timestamp'>): void;
  load(): StoredSession | null;
  clear(): void;
  updateTimestamp(): void;
}

/** Keep-alive ping to prevent server spin-down */
export interface KeepAliveAdapter {
  start(): void;
  stop(): void;
}

/** All adapters bundled for registerSocketListeners */
export interface SocketDeps {
  sound: SoundAdapter;
  session: SyncSessionAdapter;
  keepAlive: KeepAliveAdapter;
}

/** Emit function that checks connection and returns success */
export type EmitFn = (event: string, ...args: unknown[]) => boolean;

/** All game actions returned by createGameActions */
export interface GameActions {
  createRoom(playerName: string, roomName: string, isPrivate: boolean, maxPlayers?: 3 | 4): void;
  joinRoom(playerName: string, roomCode: string): void;
  leaveRoom(): void;
  setReady(isReady: boolean): void;
  addAI(): void;
  removeAI(aiId: string): void;
  startGame(): void;
  bid(amount: number): void;
  pass(): void;
  confirmTalon(): void;
  confirmWykladana(): void;
  playOrPass(decision: 'play' | 'pass'): void;
  distributeTalon(distribution: { playerId: string; card: Card }[]): void;
  playCard(card: Card): void;
  declareMarriage(suit: Suit): void;
  joinMatchmaking(playerName: string): void;
  leaveMatchmaking(): void;
  leaveGame(): void;
  pauseGame(): void;
  resumeGame(): void;
  sendEmote(emoteId: string): void;
}

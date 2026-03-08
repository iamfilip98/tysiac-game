'use client';

import { useEffect, useCallback, useRef } from 'react';
import { getSocket, connectSocket, startKeepAlive, stopKeepAlive, startVisibilityHandler, TypedSocket } from '@/lib/socket';
import { useRoomStore, registerSocketListeners, createGameActions } from '@tysiac/game-logic';
import type { SocketDeps, GameActions } from '@tysiac/game-logic';
import { useAuth } from '@clerk/nextjs';
import { saveSession, loadSession, clearSession, updateSessionTimestamp } from '@/lib/sessionStorage';
import { soundManager } from '@/lib/sounds';

// Module-level ref count: listeners are set up once and only cleaned up
// when the last consumer unmounts.
let listenerRefCount = 0;
let listenerCleanup: (() => void) | null = null;
let actionsInstance: { actions: GameActions; cleanup: () => void } | null = null;

// Web adapter implementations
const webDeps: SocketDeps = {
  sound: {
    play(name: string) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fn = (soundManager as any)[name];
      if (typeof fn === 'function') fn.call(soundManager);
    },
  },
  session: {
    save: saveSession,
    load: loadSession,
    clear: clearSession,
    updateTimestamp: updateSessionTimestamp,
  },
  keepAlive: {
    start: startKeepAlive,
    stop: stopKeepAlive,
  },
};

export function useSocket() {
  const socketRef = useRef<TypedSocket | null>(null);
  const { getToken } = useAuth();

  useEffect(() => {
    let cancelled = false;

    async function initSocket() {
      let authToken: string | undefined;
      try {
        const token = await getToken();
        if (token) authToken = token;
      } catch { /* guest — no token */ }

      if (cancelled) return;

      const socket = getSocket(authToken);
      socketRef.current = socket;

      listenerRefCount++;
      if (listenerRefCount > 1) return;

      // Register portable listeners from game-logic
      listenerCleanup = registerSocketListeners(socket as unknown as import('@tysiac/game-logic').SocketLike, webDeps);

      // Create portable actions from game-logic
      const safeEmit = (event: string, ...args: unknown[]): boolean => {
        if (!socket?.connected) {
          useRoomStore.getState().setError('Not connected to server. Please refresh the page.');
          return false;
        }
        (socket.emit as (event: string, ...args: unknown[]) => void)(event, ...args);
        return true;
      };

      actionsInstance = createGameActions(safeEmit, webDeps.session);

      // Web-specific: visibility handler for tab backgrounding
      startVisibilityHandler();

      // Connect
      async function connect() {
        useRoomStore.getState().setConnecting(true);
        try {
          await connectSocket();
          useRoomStore.getState().setConnected(true);
        } catch (err) {
          useRoomStore.getState().setError('Failed to connect to server');
        } finally {
          useRoomStore.getState().setConnecting(false);
        }
      }

      connect();
    }

    initSocket();

    return () => {
      cancelled = true;
      listenerRefCount--;
      if (listenerRefCount > 0) return;

      stopKeepAlive();
      if (listenerCleanup) {
        listenerCleanup();
        listenerCleanup = null;
      }
      if (actionsInstance) {
        actionsInstance.cleanup();
        actionsInstance = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Stable action accessors — delegate to module-level actionsInstance
  const createRoom = useCallback((...args: Parameters<GameActions['createRoom']>) => actionsInstance?.actions.createRoom(...args), []);
  const joinRoom = useCallback((...args: Parameters<GameActions['joinRoom']>) => actionsInstance?.actions.joinRoom(...args), []);
  const leaveRoom = useCallback(() => actionsInstance?.actions.leaveRoom(), []);
  const setReady = useCallback((...args: Parameters<GameActions['setReady']>) => actionsInstance?.actions.setReady(...args), []);
  const addAI = useCallback(() => actionsInstance?.actions.addAI(), []);
  const removeAI = useCallback((...args: Parameters<GameActions['removeAI']>) => actionsInstance?.actions.removeAI(...args), []);
  const startGame = useCallback(() => actionsInstance?.actions.startGame(), []);
  const bid = useCallback((...args: Parameters<GameActions['bid']>) => actionsInstance?.actions.bid(...args), []);
  const pass = useCallback(() => actionsInstance?.actions.pass(), []);
  const confirmDistribution = useCallback(() => actionsInstance?.actions.confirmDistribution(), []);
  const confirmTalon = useCallback(() => actionsInstance?.actions.confirmTalon(), []);
  const confirmWykladana = useCallback(() => actionsInstance?.actions.confirmWykladana(), []);
  const playOrPass = useCallback((...args: Parameters<GameActions['playOrPass']>) => actionsInstance?.actions.playOrPass(...args), []);
  const distributeTalon = useCallback((...args: Parameters<GameActions['distributeTalon']>) => actionsInstance?.actions.distributeTalon(...args), []);
  const playCard = useCallback((...args: Parameters<GameActions['playCard']>) => actionsInstance?.actions.playCard(...args), []);
  const declareMarriage = useCallback((...args: Parameters<GameActions['declareMarriage']>) => actionsInstance?.actions.declareMarriage(...args), []);
  const joinMatchmaking = useCallback((...args: Parameters<GameActions['joinMatchmaking']>) => actionsInstance?.actions.joinMatchmaking(...args), []);
  const leaveMatchmaking = useCallback(() => actionsInstance?.actions.leaveMatchmaking(), []);
  const leaveGame = useCallback(() => actionsInstance?.actions.leaveGame(), []);
  const pauseGame = useCallback(() => actionsInstance?.actions.pauseGame(), []);
  const resumeGame = useCallback(() => actionsInstance?.actions.resumeGame(), []);
  const sendEmote = useCallback((...args: Parameters<GameActions['sendEmote']>) => actionsInstance?.actions.sendEmote(...args), []);

  return {
    createRoom,
    joinRoom,
    leaveRoom,
    setReady,
    addAI,
    removeAI,
    startGame,
    joinMatchmaking,
    leaveMatchmaking,
    bid,
    pass,
    confirmDistribution,
    confirmTalon,
    confirmWykladana,
    playOrPass,
    distributeTalon,
    playCard,
    declareMarriage,
    leaveGame,
    pauseGame,
    resumeGame,
    sendEmote,
  };
}

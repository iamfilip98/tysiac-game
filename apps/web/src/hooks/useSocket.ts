'use client';

import { useEffect, useCallback, useRef } from 'react';
import { getSocket, connectSocket, TypedSocket } from '@/lib/socket';
import { useRoomStore } from '@/stores/roomStore';
import { useGameStore } from '@/stores/gameStore';
import { saveSession, loadSession, clearSession, updateSessionTimestamp } from '@/lib/sessionStorage';
import type { Card, Suit } from '@tysiac/shared';

export function useSocket() {
  const socketRef = useRef<TypedSocket | null>(null);
  const isAutoReconnectingRef = useRef(false);

  const {
    setRoom,
    setPlayerId,
    setConnected,
    setConnecting,
    setError,
    reset: resetRoom,
  } = useRoomStore();

  const {
    setGameState,
    setValidActions,
    setRoundResult,
    setShowGameEnd,
    setLastMarriageDeclared,
    setWykladanaData,
    setGameStatistics,
    setPassedAt100Notification,
    reset: resetGame,
  } = useGameStore();

  // Connect and set up listeners
  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    async function connect() {
      setConnecting(true);
      try {
        await connectSocket();
        setConnected(true);
      } catch (err) {
        setError('Failed to connect to server');
      } finally {
        setConnecting(false);
      }
    }

    // Socket event handlers
    socket.on('connect', () => {
      setConnected(true);
      setError(null);

      // Attempt auto-reconnect if session exists
      const storedSession = loadSession();
      if (storedSession) {
        console.log('[auto-reconnect] Found stored session, attempting reconnect...');
        isAutoReconnectingRef.current = true;
        socket.emit('player:reconnect', {
          roomId: storedSession.roomId,
          playerId: storedSession.playerId,
          sessionToken: storedSession.sessionToken,
        });
      }
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('connect_error', () => {
      setError('Connection error');
      setConnected(false);
    });

    // Room events
    socket.on('room:created', (room) => {
      setRoom(room);
      setPlayerId(room.hostId);

      // Save session to localStorage
      saveSession({
        playerId: room.hostId,
        roomId: room.id,
        sessionToken: room.sessionToken,
        playerName: room.players[0]?.name || 'Player',
      });
    });

    socket.on('room:joined', ({ room, playerId, sessionToken }) => {
      setRoom(room);
      setPlayerId(playerId);

      // Save session to localStorage
      const player = room.players.find(p => p.id === playerId);
      saveSession({
        playerId,
        roomId: room.id,
        sessionToken,
        playerName: player?.name || 'Player',
      });
    });

    socket.on('room:updated', (room) => {
      console.log('[room:updated] Received room:', room?.id, 'gameId:', room?.gameId);
      setRoom(room);
    });

    socket.on('room:error', ({ code, message }) => {
      console.log('[room:error] Error:', code, message);

      // If INVALID_SESSION during auto-reconnect on page load (no active game), fail silently
      if (code === 'INVALID_SESSION' && isAutoReconnectingRef.current) {
        const hasActiveGame = useGameStore.getState().gameState !== null;
        const hasActiveRoom = useRoomStore.getState().room !== null;

        // Only fail silently if user wasn't actively in a game/room
        if (!hasActiveGame && !hasActiveRoom) {
          console.log('[room:error] Stale session detected on page load, clearing silently');
          isAutoReconnectingRef.current = false;
          clearSession();
          return;
        }
      }

      isAutoReconnectingRef.current = false;
      setError(message);
    });

    // Game events
    socket.on('game:started', (state) => {
      console.log('[game:started] HANDLER CALLED, state:', JSON.stringify(state).slice(0, 200));
      console.log('[game:started] state.id =', state?.id);
      resetGame();
      setGameState(state);
      // Also update room with gameId since room:updated might not arrive in time
      const currentRoom = useRoomStore.getState().room;
      console.log('[game:started] currentRoom:', currentRoom?.id, 'state.id:', state?.id);
      if (currentRoom && state?.id) {
        console.log('[game:started] Updating room gameId:', state.id);
        setRoom({ ...currentRoom, gameId: state.id });
      } else {
        console.log('[game:started] SKIPPED room update - currentRoom:', !!currentRoom, 'state.id:', state?.id);
      }
    });

    socket.on('game:stateUpdate', (state) => {
      console.log('[game:stateUpdate] Received update, phase:', state?.phase);
      setGameState(state);
      // Clear wykladana modal when phase changes away from wykladana
      if (state?.phase !== 'wykladana') {
        setWykladanaData(null);
      }
    });

    socket.on('game:yourTurn', ({ validActions }) => {
      console.log('[game:yourTurn] RECEIVED! validActions:', validActions?.length, validActions);
      setValidActions(validActions);
    });

    socket.on('game:roundEnd', (result) => {
      setRoundResult(result);
    });

    socket.on('game:ended', ({ winnerId, statistics }) => {
      setShowGameEnd(true);
      if (statistics) {
        setGameStatistics(statistics);
      }
      // Clear session when game ends
      clearSession();
    });

    socket.on('game:error', ({ message }) => {
      setError(message);
    });

    socket.on('game:marriageDeclared', ({ playerId, suit }) => {
      console.log('[game:marriageDeclared]', playerId, suit);
      setLastMarriageDeclared({ playerId, suit });
      // Marriage indicator will be cleared when trick completes (game:trickWon)
    });

    socket.on('game:trickWon', () => {
      // Clear marriage indicator when trick completes
      setLastMarriageDeclared(null);
    });

    socket.on('game:wykladana', (data: { playerId: string; playerName: string; bid: number; marriagePoints?: number; cards: Card[] }) => {
      setWykladanaData({ playerName: data.playerName, bid: data.bid, marriagePoints: data.marriagePoints, cards: data.cards });
    });

    socket.on('game:playerPassedAt100', (data: { playerId: string; playerName: string }) => {
      setPassedAt100Notification({ playerName: data.playerName });
    });

    // Reconnection
    socket.on('connection:restored', ({ room, gameState, validActions }) => {
      // Clear auto-reconnect flag on successful restore
      isAutoReconnectingRef.current = false;

      // Restore playerId from session
      const storedSession = loadSession();
      if (storedSession) {
        setPlayerId(storedSession.playerId);
      }

      setRoom(room);
      if (gameState) {
        setGameState(gameState);
      }
      if (validActions && validActions.length > 0) {
        setValidActions(validActions);
      }
      updateSessionTimestamp();
    });

    connect();

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('room:created');
      socket.off('room:joined');
      socket.off('room:updated');
      socket.off('room:error');
      socket.off('game:started');
      socket.off('game:stateUpdate');
      socket.off('game:yourTurn');
      socket.off('game:roundEnd');
      socket.off('game:ended');
      socket.off('game:error');
      socket.off('game:marriageDeclared');
      socket.off('game:trickWon');
      socket.off('game:wykladana');
      socket.off('game:playerPassedAt100');
      socket.off('connection:restored');
    };
  }, []);

  // Helper to check connection and emit with error handling
  const safeEmit = useCallback((
    event: string,
    ...args: unknown[]
  ): boolean => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      setError('Not connected to server. Please refresh the page.');
      return false;
    }
    (socket.emit as (event: string, ...args: unknown[]) => void)(event, ...args);
    return true;
  }, [setError]);

  // Room actions
  const createRoom = useCallback((playerName: string, roomName: string, isPrivate: boolean, maxPlayers: 3 | 4 = 3) => {
    safeEmit('room:create', { playerName, roomName, isPrivate, maxPlayers });
  }, [safeEmit]);

  const joinRoom = useCallback((playerName: string, roomCode: string) => {
    safeEmit('room:join', { playerName, roomCode });
  }, [safeEmit]);

  const leaveRoom = useCallback(() => {
    safeEmit('room:leave');
    clearSession(); // Clear localStorage when intentionally leaving
    resetRoom();
    resetGame();
  }, [safeEmit, resetRoom, resetGame]);

  const setReady = useCallback((isReady: boolean) => {
    safeEmit('room:ready', isReady);
  }, [safeEmit]);

  const addAI = useCallback(() => {
    safeEmit('room:addAI');
  }, [safeEmit]);

  const removeAI = useCallback((aiId: string) => {
    safeEmit('room:removeAI', aiId);
  }, [safeEmit]);

  const startGame = useCallback(() => {
    safeEmit('room:startGame');
  }, [safeEmit]);

  // Game actions
  const bid = useCallback((amount: number) => {
    if (safeEmit('game:bid', amount)) {
      setValidActions([]);
    }
  }, [safeEmit, setValidActions]);

  const pass = useCallback(() => {
    if (safeEmit('game:pass')) {
      setValidActions([]);
    }
  }, [safeEmit, setValidActions]);

  const distributeTalon = useCallback((distribution: { playerId: string; card: Card }[]) => {
    if (safeEmit('game:distributeTalon', distribution)) {
      setValidActions([]);
    }
  }, [safeEmit, setValidActions]);

  const playCard = useCallback((card: Card) => {
    if (safeEmit('game:playCard', card)) {
      setValidActions([]);
    }
  }, [safeEmit, setValidActions]);

  const declareMarriage = useCallback((suit: Suit) => {
    safeEmit('game:declareMarriage', suit);
  }, [safeEmit]);

  const confirmTalon = useCallback(() => {
    safeEmit('game:confirmTalon');
  }, [safeEmit]);

  const confirmWykladana = useCallback(() => {
    safeEmit('game:confirmWykladana');
  }, [safeEmit]);

  const playOrPass = useCallback((decision: 'play' | 'pass') => {
    if (safeEmit('game:playOrPass', decision)) {
      setValidActions([]);
    }
  }, [safeEmit, setValidActions]);

  const leaveGame = useCallback(() => {
    if (safeEmit('game:leave')) {
      clearSession();
      resetRoom();
      resetGame();
    }
  }, [safeEmit, resetRoom, resetGame]);

  return {
    // Room actions
    createRoom,
    joinRoom,
    leaveRoom,
    setReady,
    addAI,
    removeAI,
    startGame,

    // Game actions
    bid,
    pass,
    confirmTalon,
    confirmWykladana,
    playOrPass,
    distributeTalon,
    playCard,
    declareMarriage,
    leaveGame,
  };
}

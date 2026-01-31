'use client';

import { useEffect, useCallback, useRef } from 'react';
import { getSocket, connectSocket, TypedSocket } from '@/lib/socket';
import { useRoomStore } from '@/stores/roomStore';
import { useGameStore } from '@/stores/gameStore';
import type { Card, Suit } from '@tysiac/shared';

export function useSocket() {
  const socketRef = useRef<TypedSocket | null>(null);

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
    });

    socket.on('room:joined', ({ room, playerId }) => {
      setRoom(room);
      setPlayerId(playerId);
    });

    socket.on('room:updated', (room) => {
      console.log('[room:updated] Received room:', room?.id, 'gameId:', room?.gameId);
      setRoom(room);
    });

    socket.on('room:error', ({ code, message }) => {
      console.log('[room:error] Error:', code, message);
      setError(message);
    });

    // Game events
    socket.on('game:started', (state) => {
      console.log('[game:started] Received game state, gameId:', state.id);
      resetGame();
      setGameState(state);
      // Also update room with gameId since room:updated might not arrive in time
      const currentRoom = useRoomStore.getState().room;
      if (currentRoom && state.id) {
        console.log('[game:started] Updating room gameId:', state.id);
        setRoom({ ...currentRoom, gameId: state.id });
      }
    });

    socket.on('game:stateUpdate', (state) => {
      setGameState(state);
    });

    socket.on('game:yourTurn', ({ validActions }) => {
      setValidActions(validActions);
    });

    socket.on('game:roundEnd', (result) => {
      setRoundResult(result);
    });

    socket.on('game:ended', ({ winnerId }) => {
      setShowGameEnd(true);
    });

    socket.on('game:error', ({ message }) => {
      setError(message);
    });

    // Reconnection
    socket.on('connection:restored', ({ room, gameState }) => {
      setRoom(room);
      if (gameState) {
        setGameState(gameState);
      }
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
  const createRoom = useCallback((playerName: string, roomName: string, isPrivate: boolean) => {
    safeEmit('room:create', { playerName, roomName, isPrivate });
  }, [safeEmit]);

  const joinRoom = useCallback((playerName: string, roomCode: string) => {
    safeEmit('room:join', { playerName, roomCode });
  }, [safeEmit]);

  const leaveRoom = useCallback(() => {
    safeEmit('room:leave');
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
    distributeTalon,
    playCard,
    declareMarriage,
  };
}

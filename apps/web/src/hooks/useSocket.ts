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
      setRoom(room);
    });

    socket.on('room:error', ({ message }) => {
      setError(message);
    });

    // Game events
    socket.on('game:started', (state) => {
      setGameState(state);
      resetGame();
      setGameState(state);
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

  // Room actions
  const createRoom = useCallback((playerName: string, roomName: string, isPrivate: boolean) => {
    socketRef.current?.emit('room:create', { playerName, roomName, isPrivate });
  }, []);

  const joinRoom = useCallback((playerName: string, roomCode: string) => {
    socketRef.current?.emit('room:join', { playerName, roomCode });
  }, []);

  const leaveRoom = useCallback(() => {
    socketRef.current?.emit('room:leave');
    resetRoom();
    resetGame();
  }, [resetRoom, resetGame]);

  const setReady = useCallback((isReady: boolean) => {
    socketRef.current?.emit('room:ready', isReady);
  }, []);

  const addAI = useCallback(() => {
    socketRef.current?.emit('room:addAI');
  }, []);

  const removeAI = useCallback((aiId: string) => {
    socketRef.current?.emit('room:removeAI', aiId);
  }, []);

  const startGame = useCallback(() => {
    socketRef.current?.emit('room:startGame');
  }, []);

  // Game actions
  const bid = useCallback((amount: number) => {
    socketRef.current?.emit('game:bid', amount);
    setValidActions([]);
  }, [setValidActions]);

  const pass = useCallback(() => {
    socketRef.current?.emit('game:pass');
    setValidActions([]);
  }, [setValidActions]);

  const distributeTalon = useCallback((distribution: { playerId: string; card: Card }[]) => {
    socketRef.current?.emit('game:distributeTalon', distribution);
    setValidActions([]);
  }, [setValidActions]);

  const playCard = useCallback((card: Card) => {
    socketRef.current?.emit('game:playCard', card);
    setValidActions([]);
  }, [setValidActions]);

  const declareMarriage = useCallback((suit: Suit) => {
    socketRef.current?.emit('game:declareMarriage', suit);
  }, []);

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
    distributeTalon,
    playCard,
    declareMarriage,
  };
}

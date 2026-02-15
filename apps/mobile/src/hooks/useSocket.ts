import { useEffect, useCallback, useRef } from 'react';
import { getSocket, connectSocket, TypedSocket } from '@/lib/socket';
import { useRoomStore } from '@/stores/roomStore';
import { useGameStore } from '@/stores/gameStore';
import { saveSession, loadSession, clearSession, updateSessionTimestamp } from '@/lib/storage';
import type { Card, Suit } from '@tysiac/shared';

export function useSocket() {
  const socketRef = useRef<TypedSocket | null>(null);
  const isAutoReconnectingRef = useRef(false);
  const marriageClearTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    setRoom,
    setPlayerId,
    setConnected,
    setConnecting,
    setError,
    setPublicRooms,
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
    setThrewNotification,
    setPauseData,
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
    socket.on('connect', async () => {
      setConnected(true);
      setError(null);

      // Attempt auto-reconnect if session exists
      const storedSession = await loadSession();
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
    socket.on('room:created', async (room) => {
      setRoom(room);
      setPlayerId(room.hostId);

      // Save session
      await saveSession({
        playerId: room.hostId,
        roomId: room.id,
        sessionToken: room.sessionToken,
        playerName: room.players[0]?.name || 'Player',
      });
    });

    socket.on('room:joined', async ({ room, playerId, sessionToken }) => {
      setRoom(room);
      setPlayerId(playerId);

      // Save session
      const player = room.players.find(p => p.id === playerId);
      await saveSession({
        playerId,
        roomId: room.id,
        sessionToken,
        playerName: player?.name || 'Player',
      });
    });

    socket.on('room:updated', (room) => {
      setRoom(room);
    });

    socket.on('room:error', async ({ code, message }) => {
      // If INVALID_SESSION during auto-reconnect on app start, fail silently
      if (code === 'INVALID_SESSION' && isAutoReconnectingRef.current) {
        const hasActiveGame = useGameStore.getState().gameState !== null;
        const hasActiveRoom = useRoomStore.getState().room !== null;

        if (!hasActiveGame && !hasActiveRoom) {
          console.log('[room:error] Stale session detected on app start, clearing silently');
          isAutoReconnectingRef.current = false;
          await clearSession();
          return;
        }
      }

      isAutoReconnectingRef.current = false;
      setError(message);
    });

    // Game events
    socket.on('game:started', (state) => {
      resetGame();
      setGameState(state);
      // Also update room with gameId
      const currentRoom = useRoomStore.getState().room;
      if (currentRoom && state?.id) {
        setRoom({ ...currentRoom, gameId: state.id });
      }
    });

    socket.on('game:stateUpdate', (state) => {
      setGameState(state);
      // Clear wykladana modal when phase changes
      if (state?.phase !== 'wykladana') {
        setWykladanaData(null);
      }
    });

    socket.on('game:yourTurn', ({ validActions }) => {
      setValidActions(validActions);
    });

    socket.on('game:roundEnd', (result) => {
      setRoundResult(result);
    });

    socket.on('game:ended', async ({ winnerId, statistics }) => {
      setShowGameEnd(true);
      if (statistics) {
        setGameStatistics(statistics);
      }
      // Clear session when game ends
      await clearSession();
    });

    socket.on('game:error', ({ message }) => {
      setError(message);
    });

    socket.on('game:marriageDeclared', ({ playerId, suit }) => {
      if (marriageClearTimeoutRef.current) clearTimeout(marriageClearTimeoutRef.current);
      setLastMarriageDeclared({ playerId, suit });
    });

    socket.on('game:trickWon', () => {
      if (marriageClearTimeoutRef.current) clearTimeout(marriageClearTimeoutRef.current);
      marriageClearTimeoutRef.current = setTimeout(() => setLastMarriageDeclared(null), 1500);
    });

    socket.on('game:wykladana', (data) => {
      setWykladanaData({
        playerName: data.playerName,
        bid: data.bid,
        marriagePoints: data.marriagePoints,
        cards: data.cards,
      });
    });

    socket.on('game:playerPassedAt100', (data) => {
      setPassedAt100Notification({ playerName: data.playerName });
    });

    socket.on('game:playerThrew', (data) => {
      setThrewNotification({
        playerName: data.playerName,
        bidAmount: data.bidAmount,
        scoreChanges: data.scoreChanges,
      });
    });

    socket.on('game:paused', (data) => {
      setPauseData({
        pausedByName: data.pausedByName,
        pausedAt: data.pausedAt,
        expiresAt: data.expiresAt,
      });
    });

    socket.on('game:resumed', () => {
      setPauseData(null);
    });

    socket.on('game:pauseExpired', () => {
      setPauseData(null);
    });

    // Lobby
    socket.on('lobby:roomList', (rooms) => {
      setPublicRooms(rooms);
    });

    // Reconnection
    socket.on('connection:restored', async ({ room, gameState, validActions }) => {
      isAutoReconnectingRef.current = false;

      // Restore playerId from session
      const storedSession = await loadSession();
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
      await updateSessionTimestamp();
    });

    connect();

    return () => {
      if (marriageClearTimeoutRef.current) clearTimeout(marriageClearTimeoutRef.current);
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
      socket.off('game:playerThrew');
      socket.off('game:paused');
      socket.off('game:resumed');
      socket.off('game:pauseExpired');
      socket.off('lobby:roomList');
      socket.off('connection:restored');
    };
  }, []);

  // Helper to check connection and emit with error handling
  const safeEmit = useCallback(
    (event: string, ...args: unknown[]): boolean => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        setError('Not connected to server. Please check your connection.');
        return false;
      }
      (socket.emit as (event: string, ...args: unknown[]) => void)(event, ...args);
      return true;
    },
    [setError]
  );

  // Room actions
  const createRoom = useCallback(
    (playerName: string, roomName: string, isPrivate: boolean, maxPlayers: 3 | 4 = 3) => {
      safeEmit('room:create', { playerName, roomName, isPrivate, maxPlayers });
    },
    [safeEmit]
  );

  const joinRoom = useCallback(
    (playerName: string, roomCode: string) => {
      safeEmit('room:join', { playerName, roomCode });
    },
    [safeEmit]
  );

  const leaveRoom = useCallback(async () => {
    safeEmit('room:leave');
    await clearSession();
    resetRoom();
    resetGame();
  }, [safeEmit, resetRoom, resetGame]);

  const setReady = useCallback(
    (isReady: boolean) => {
      safeEmit('room:ready', isReady);
    },
    [safeEmit]
  );

  const addAI = useCallback(() => {
    safeEmit('room:addAI');
  }, [safeEmit]);

  const removeAI = useCallback(
    (aiId: string) => {
      safeEmit('room:removeAI', aiId);
    },
    [safeEmit]
  );

  const startGame = useCallback(() => {
    safeEmit('room:startGame');
  }, [safeEmit]);

  // Game actions
  const bid = useCallback(
    (amount: number) => {
      if (safeEmit('game:bid', amount)) {
        setValidActions([]);
      }
    },
    [safeEmit, setValidActions]
  );

  const pass = useCallback(() => {
    if (safeEmit('game:pass')) {
      setValidActions([]);
    }
  }, [safeEmit, setValidActions]);

  const distributeTalon = useCallback(
    (distribution: { playerId: string; card: Card }[]) => {
      if (safeEmit('game:distributeTalon', distribution)) {
        setValidActions([]);
      }
    },
    [safeEmit, setValidActions]
  );

  const playCard = useCallback(
    (card: Card) => {
      if (safeEmit('game:playCard', card)) {
        setValidActions([]);
      }
    },
    [safeEmit, setValidActions]
  );

  const declareMarriage = useCallback(
    (suit: Suit) => {
      safeEmit('game:declareMarriage', suit);
    },
    [safeEmit]
  );

  const confirmTalon = useCallback(() => {
    safeEmit('game:confirmTalon');
  }, [safeEmit]);

  const confirmWykladana = useCallback(() => {
    safeEmit('game:confirmWykladana');
  }, [safeEmit]);

  const playOrPass = useCallback(
    (decision: 'play' | 'pass') => {
      if (safeEmit('game:playOrPass', decision)) {
        setValidActions([]);
      }
    },
    [safeEmit, setValidActions]
  );

  const leaveGame = useCallback(async () => {
    if (safeEmit('game:leave')) {
      await clearSession();
      resetRoom();
      resetGame();
    }
  }, [safeEmit, resetRoom, resetGame]);

  const pauseGame = useCallback(() => {
    safeEmit('game:pause');
  }, [safeEmit]);

  const resumeGame = useCallback(() => {
    safeEmit('game:resume');
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
    confirmWykladana,
    playOrPass,
    distributeTalon,
    playCard,
    declareMarriage,
    leaveGame,
    pauseGame,
    resumeGame,
  };
}

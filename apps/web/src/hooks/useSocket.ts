'use client';

import { useEffect, useCallback, useRef } from 'react';
import { getSocket, connectSocket, startKeepAlive, stopKeepAlive, startVisibilityHandler, TypedSocket } from '@/lib/socket';
import { useRoomStore } from '@/stores/roomStore';
import { useGameStore } from '@/stores/gameStore';
import { saveSession, loadSession, clearSession, updateSessionTimestamp } from '@/lib/sessionStorage';
import { soundManager } from '@/lib/sounds';
import type { Card, Suit } from '@tysiac/shared';

export function useSocket() {
  const socketRef = useRef<TypedSocket | null>(null);
  const isAutoReconnectingRef = useRef(false);
  const trickWonTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const marriageClearTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    setRoom,
    setPlayerId,
    setConnected,
    setConnecting,
    setError,
    setPublicRooms,
    clearRoom,
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
    setTrickWonData,
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
        isAutoReconnectingRef.current = true;
        socket.emit('player:reconnect', {
          roomId: storedSession.roomId,
          playerId: storedSession.playerId,
          sessionToken: storedSession.sessionToken,
        });
      }
    });

    socket.on('disconnect', (reason) => {
      setConnected(false);
      // If server forcefully closed the connection, it won't auto-reconnect
      // Manually trigger reconnect for transport-level disconnects
      if (reason === 'transport close' || reason === 'ping timeout') {
        console.log(`[Socket] Disconnected (${reason}), will auto-reconnect...`);
      }
    });

    socket.on('connect_error', () => {
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
      setRoom(room);
    });

    socket.on('room:error', ({ code, message }) => {
      // If INVALID_SESSION during auto-reconnect on page load (no active game), fail silently
      if (code === 'INVALID_SESSION' && isAutoReconnectingRef.current) {
        const hasActiveGame = useGameStore.getState().gameState !== null;
        const hasActiveRoom = useRoomStore.getState().room !== null;

        // Only fail silently if user wasn't actively in a game/room
        if (!hasActiveGame && !hasActiveRoom) {
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
      resetGame();
      setGameState(state);
      startKeepAlive();
      // Also update room with gameId since room:updated might not arrive in time
      const currentRoom = useRoomStore.getState().room;
      if (currentRoom && state?.id) {
        setRoom({ ...currentRoom, gameId: state.id });
      }
    });

    socket.on('game:stateUpdate', (state) => {
      // Detect new card played by comparing trick cards
      const prevState = useGameStore.getState().gameState;
      const prevTrickCards = prevState?.round?.currentTrick?.cards?.length ?? 0;
      const newTrickCards = state?.round?.currentTrick?.cards?.length ?? 0;
      if (newTrickCards > prevTrickCards) {
        soundManager.cardPlay();
      }

      setGameState(state);
      // Clear wykladana modal when phase changes away from wykladana
      if (state?.phase !== 'wykladana') {
        setWykladanaData(null);
      }
    });

    socket.on('game:yourTurn', ({ validActions }) => {
      setValidActions(validActions);
      soundManager.yourTurn();
    });

    socket.on('game:roundEnd', (result) => {
      setRoundResult(result);
      soundManager.roundEnd();
    });

    socket.on('game:ended', ({ winnerId, statistics }) => {
      stopKeepAlive();
      setShowGameEnd(true);
      if (statistics) {
        setGameStatistics(statistics);
      }
      soundManager.gameWin();
      // Don't clear session here - player may want to click "Play Again"
      // Session is cleared when player explicitly leaves via leaveRoom or leaveGame
    });

    socket.on('game:error', ({ message }) => {
      setError(message);
    });

    socket.on('game:marriageDeclared', ({ playerId, suit }) => {
      if (marriageClearTimeoutRef.current) clearTimeout(marriageClearTimeoutRef.current);
      setLastMarriageDeclared({ playerId, suit });
      soundManager.marriage();
      // Marriage indicator will be cleared when trick completes (game:trickWon)
    });

    socket.on('game:trickWon', (data: { winnerId: string; cards: Card[]; points: number }) => {
      // Delay clearing marriage indicator so the queen keeps its gold glow
      // during the trick exit animation (prevents blue trump flash)
      if (marriageClearTimeoutRef.current) clearTimeout(marriageClearTimeoutRef.current);
      marriageClearTimeoutRef.current = setTimeout(() => setLastMarriageDeclared(null), 1500);
      soundManager.trickWon();

      // Determine if trump was used to win (trump card played into a non-trump lead)
      const trumpSuit = useGameStore.getState().gameState?.round?.trumpSuit;
      if (trumpSuit && data.cards.length > 0) {
        const leadSuit = data.cards[0].suit;
        const hasTrumpCard = data.cards.some(c => c.suit === trumpSuit);
        const wasTrumpWin = hasTrumpCard && leadSuit !== trumpSuit;
        if (wasTrumpWin) {
          setTrickWonData({ winnerId: data.winnerId, wasTrumpWin: true });
          if (trickWonTimeoutRef.current) clearTimeout(trickWonTimeoutRef.current);
          trickWonTimeoutRef.current = setTimeout(() => setTrickWonData(null), 1500);
        }
      }
    });

    socket.on('game:wykladana', (data: { playerId: string; playerName: string; bid: number; marriagePoints?: number; cards: Card[] }) => {
      setWykladanaData({ playerName: data.playerName, bid: data.bid, marriagePoints: data.marriagePoints, cards: data.cards });
      soundManager.wykladana();
    });

    socket.on('game:playerPassedAt100', (data: { playerId: string; playerName: string }) => {
      setPassedAt100Notification({ playerName: data.playerName });
    });

    socket.on('game:playerThrew', (data: { playerId: string; playerName: string; bidAmount: number; scoreChanges: Record<string, number> }) => {
      setThrewNotification({ playerName: data.playerName, bidAmount: data.bidAmount, scoreChanges: data.scoreChanges });
    });

    socket.on('game:paused', (data: { pausedBy: string; pausedByName: string; pausedAt: number; expiresAt: number }) => {
      setPauseData({ pausedByName: data.pausedByName, pausedAt: data.pausedAt, expiresAt: data.expiresAt });
    });

    socket.on('game:resumed', () => {
      setPauseData(null);
    });

    socket.on('game:pauseExpired', () => {
      setPauseData(null);
      // The game will end and be handled through normal game end flow
    });

    // Lobby
    socket.on('lobby:roomList', (rooms) => {
      setPublicRooms(rooms);
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
        startKeepAlive();
      }
      if (validActions && validActions.length > 0) {
        setValidActions(validActions);
      }
      updateSessionTimestamp();
    });

    // Detect tab visibility changes and reconnect if socket died in background
    startVisibilityHandler();

    connect();

    return () => {
      stopKeepAlive();
      if (trickWonTimeoutRef.current) clearTimeout(trickWonTimeoutRef.current);
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
    clearRoom();
    resetGame();
  }, [safeEmit, clearRoom, resetGame]);

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
      clearRoom();
      resetGame();
    }
  }, [safeEmit, clearRoom, resetGame]);

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

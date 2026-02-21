'use client';

import { useEffect, useCallback, useRef } from 'react';
import { getSocket, connectSocket, startKeepAlive, stopKeepAlive, startVisibilityHandler, TypedSocket } from '@/lib/socket';
import { useRoomStore } from '@/stores/roomStore';
import { useGameStore } from '@/stores/gameStore';
import { saveSession, loadSession, clearSession, updateSessionTimestamp } from '@/lib/sessionStorage';
import { soundManager } from '@/lib/sounds';
import type { Card, Suit } from '@tysiac/shared';

// Module-level ref count: listeners are set up once and only cleaned up
// when the last consumer unmounts. This prevents GameBoard's unmount from
// tearing down listeners that page.tsx still needs.
let listenerRefCount = 0;
let trickWonTimeout: NodeJS.Timeout | null = null;
let marriageClearTimeout: NodeJS.Timeout | null = null;
let createRoomTimeout: NodeJS.Timeout | null = null;
let isAutoReconnecting = false;

export function useSocket() {
  const socketRef = useRef<TypedSocket | null>(null);

  // Connect and set up listeners (ref-counted: only the first mount sets up
  // listeners, only the last unmount tears them down). This prevents GameBoard's
  // unmount from destroying listeners that page.tsx still needs.
  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    listenerRefCount++;
    if (listenerRefCount > 1) {
      // Listeners already set up by another consumer — just grab the socket ref
      return () => { listenerRefCount--; };
    }

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

    // Socket event handlers — use store.getState() for all state access
    // so handlers never go stale (they close over nothing from React).
    socket.on('connect', () => {
      useRoomStore.getState().setConnected(true);
      useRoomStore.getState().setError(null);
      startKeepAlive();

      // Attempt auto-reconnect if session exists
      const storedSession = loadSession();
      if (storedSession) {
        isAutoReconnecting = true;
        socket.emit('player:reconnect', {
          roomId: storedSession.roomId,
          playerId: storedSession.playerId,
          sessionToken: storedSession.sessionToken,
        });
      }
    });

    socket.on('disconnect', (reason) => {
      useRoomStore.getState().setConnected(false);
      useRoomStore.getState().setCreatingRoom(false);
      // If server forcefully closed the connection, it won't auto-reconnect
      // Manually trigger reconnect for transport-level disconnects
      if (reason === 'transport close' || reason === 'ping timeout') {
        console.log(`[Socket] Disconnected (${reason}), will auto-reconnect...`);
      }
    });

    socket.on('connect_error', () => {
      useRoomStore.getState().setConnected(false);
    });

    // Room events
    socket.on('room:created', (room) => {
      if (createRoomTimeout) clearTimeout(createRoomTimeout);
      useRoomStore.getState().setCreatingRoom(false);
      useRoomStore.getState().setRoom(room);
      useRoomStore.getState().setPlayerId(room.hostId);

      // Save session to localStorage
      saveSession({
        playerId: room.hostId,
        roomId: room.id,
        sessionToken: room.sessionToken,
        playerName: room.players[0]?.name || 'Player',
      });
    });

    socket.on('room:joined', ({ room, playerId, sessionToken }) => {
      useRoomStore.getState().setRoom(room);
      useRoomStore.getState().setPlayerId(playerId);

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
      // Fallback: if we're still in "Creating Room" state and get room data, treat as success
      if (useRoomStore.getState().isCreatingRoom) {
        if (createRoomTimeout) clearTimeout(createRoomTimeout);
        useRoomStore.getState().setCreatingRoom(false);
      }
      useRoomStore.getState().setRoom(room);
    });

    socket.on('room:error', ({ code, message }) => {
      if (createRoomTimeout) clearTimeout(createRoomTimeout);
      useRoomStore.getState().setCreatingRoom(false);
      // If INVALID_SESSION during auto-reconnect on page load (no active game), fail silently
      if (code === 'INVALID_SESSION' && isAutoReconnecting) {
        const hasActiveGame = useGameStore.getState().gameState !== null;
        const hasActiveRoom = useRoomStore.getState().room !== null;

        // Only fail silently if user wasn't actively in a game/room
        if (!hasActiveGame && !hasActiveRoom) {
          isAutoReconnecting = false;
          clearSession();
          return;
        }
      }

      isAutoReconnecting = false;
      useRoomStore.getState().setError(message);
    });

    // Game events
    socket.on('game:started', (state) => {
      useGameStore.getState().reset();
      useGameStore.getState().setGameState(state);
      startKeepAlive();
      // Also update room with gameId since room:updated might not arrive in time
      const currentRoom = useRoomStore.getState().room;
      if (currentRoom && state?.id) {
        useRoomStore.getState().setRoom({ ...currentRoom, gameId: state.id });
      }
    });

    socket.on('game:stateUpdate', (state) => {
      useGameStore.getState().setGameState(state);
      // Clear wykladana modal when phase changes away from wykladana
      if (state?.phase !== 'wykladana') {
        useGameStore.getState().setWykladanaData(null);
      }
    });

    socket.on('game:yourTurn', ({ validActions }) => {
      useGameStore.getState().setValidActions(validActions);
      soundManager.yourTurn();
    });

    socket.on('game:roundEnd', (result) => {
      // Skip round summary when the game is over — go straight to game end modal
      if (!result.gameWinner) {
        useGameStore.getState().setRoundResult(result);
      }
      soundManager.roundEnd();
    });

    socket.on('game:ended', ({ winnerId, statistics }) => {
      stopKeepAlive();
      useGameStore.getState().setShowGameEnd(true);
      if (statistics) {
        useGameStore.getState().setGameStatistics(statistics);
      }
      soundManager.gameWin();
      // Don't clear session here - player may want to click "Play Again"
      // Session is cleared when player explicitly leaves via leaveRoom or leaveGame
    });

    // Optimistic trick card rendering — when a card is played, add it to the
    // current trick immediately so the card visually appears in the center
    // without waiting for the next game:stateUpdate broadcast.
    socket.on('game:cardPlayed', ({ playerId, card }: { playerId: string; card: Card }) => {
      const gs = useGameStore.getState().gameState;
      if (!gs?.round?.currentTrick) return;
      // Only append if this card isn't already in the trick (avoid duplicates from stateUpdate)
      const already = gs.round.currentTrick.cards.some(
        c => c.card.suit === card.suit && c.card.rank === card.rank
      );
      if (already) return;
      soundManager.cardPlay();
      // Remove card from own hand if we played it (prevents card appearing in both hand and trick)
      const myId = useRoomStore.getState().playerId;
      const myHand = playerId === myId
        ? gs.myHand.filter(c => !(c.suit === card.suit && c.rank === card.rank))
        : gs.myHand;
      // Advance currentPlayer so the turn indicator updates immediately
      const newCards = [...gs.round.currentTrick.cards, { playerId, card }];
      let nextPlayer = gs.round.currentTrick.currentPlayer;
      if (newCards.length < 3) {
        const players = gs.players;
        const idx = players.findIndex(p => p.id === playerId);
        let nextIdx = (idx + 1) % players.length;
        // Skip sitting-out dealer in 4-player mode
        if (players.length === 4 && players[nextIdx].id === gs.round.dealer) {
          nextIdx = (nextIdx + 1) % players.length;
        }
        nextPlayer = players[nextIdx].id;
      }
      useGameStore.getState().setGameState({
        ...gs,
        myHand,
        round: {
          ...gs.round,
          currentTrick: {
            ...gs.round.currentTrick,
            cards: newCards,
            currentPlayer: nextPlayer,
          },
        },
      });
    });

    socket.on('game:error', ({ message }) => {
      useRoomStore.getState().setError(message);
    });

    socket.on('game:marriageDeclared', ({ playerId, suit }) => {
      if (marriageClearTimeout) clearTimeout(marriageClearTimeout);
      useGameStore.getState().setLastMarriageDeclared({ playerId, suit });
      soundManager.marriage();
      // Marriage indicator will be cleared when trick completes (game:trickWon)
    });

    socket.on('game:trickWon', (data: { winnerId: string; cards: Card[]; points: number }) => {
      // Delay clearing marriage indicator so the queen keeps its gold glow
      // during the trick exit animation (prevents blue trump flash)
      if (marriageClearTimeout) clearTimeout(marriageClearTimeout);
      marriageClearTimeout = setTimeout(() => useGameStore.getState().setLastMarriageDeclared(null), 1500);
      soundManager.trickWon();

      // Determine if trump was used to win (trump card played into a non-trump lead)
      const trumpSuit = useGameStore.getState().gameState?.round?.trumpSuit;
      if (trumpSuit && data.cards.length > 0) {
        const leadSuit = data.cards[0].suit;
        const hasTrumpCard = data.cards.some(c => c.suit === trumpSuit);
        const wasTrumpWin = hasTrumpCard && leadSuit !== trumpSuit;
        if (wasTrumpWin) {
          useGameStore.getState().setTrickWonData({ winnerId: data.winnerId, wasTrumpWin: true });
          if (trickWonTimeout) clearTimeout(trickWonTimeout);
          trickWonTimeout = setTimeout(() => useGameStore.getState().setTrickWonData(null), 1500);
        }
      }
    });

    socket.on('game:wykladana', (data: { playerId: string; playerName: string; bid: number; marriagePoints?: number; cards: Card[] }) => {
      useGameStore.getState().setWykladanaData({ playerName: data.playerName, bid: data.bid, marriagePoints: data.marriagePoints, cards: data.cards });
      soundManager.wykladana();
    });

    socket.on('game:playerPassedAt100', (data: { playerId: string; playerName: string }) => {
      useGameStore.getState().setPassedAt100Notification({ playerName: data.playerName });
    });

    socket.on('game:playerThrew', (data: { playerId: string; playerName: string; bidAmount: number; scoreChanges: Record<string, number> }) => {
      useGameStore.getState().setThrewNotification({ playerName: data.playerName, bidAmount: data.bidAmount, scoreChanges: data.scoreChanges });
    });

    socket.on('game:paused', (data: { pausedBy: string; pausedByName: string; pausedAt: number; expiresAt: number }) => {
      useGameStore.getState().setPauseData({ pausedByName: data.pausedByName, pausedAt: data.pausedAt, expiresAt: data.expiresAt });
    });

    socket.on('game:resumed', () => {
      useGameStore.getState().setPauseData(null);
    });

    socket.on('game:pauseExpired', () => {
      useGameStore.getState().setPauseData(null);
      // The game will end and be handled through normal game end flow
    });

    // Lobby
    socket.on('lobby:roomList', (rooms) => {
      useRoomStore.getState().setPublicRooms(rooms);
    });

    // Reconnection
    socket.on('connection:restored', ({ room, gameState, validActions }) => {
      // Clear auto-reconnect flag on successful restore
      isAutoReconnecting = false;

      // Restore playerId from session
      const storedSession = loadSession();
      if (storedSession) {
        useRoomStore.getState().setPlayerId(storedSession.playerId);
      }

      useRoomStore.getState().setRoom(room);
      if (gameState) {
        useGameStore.getState().setGameState(gameState);
        startKeepAlive();
      }
      if (validActions && validActions.length > 0) {
        useGameStore.getState().setValidActions(validActions);
      }
      updateSessionTimestamp();
    });

    // Detect tab visibility changes and reconnect if socket died in background
    startVisibilityHandler();

    connect();

    return () => {
      listenerRefCount--;
      if (listenerRefCount > 0) return; // Other consumers still mounted

      stopKeepAlive();
      if (trickWonTimeout) clearTimeout(trickWonTimeout);
      if (marriageClearTimeout) clearTimeout(marriageClearTimeout);
      if (createRoomTimeout) clearTimeout(createRoomTimeout);
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('room:created');
      socket.off('room:joined');
      socket.off('room:updated');
      socket.off('room:error');
      socket.off('game:started');
      socket.off('game:cardPlayed');
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
      useRoomStore.getState().setError('Not connected to server. Please refresh the page.');
      return false;
    }
    (socket.emit as (event: string, ...args: unknown[]) => void)(event, ...args);
    return true;
  }, []);

  // Room actions
  const createRoom = useCallback((playerName: string, roomName: string, isPrivate: boolean, maxPlayers: 3 | 4 = 3) => {
    if (safeEmit('room:create', { playerName, roomName, isPrivate, maxPlayers })) {
      useRoomStore.getState().setCreatingRoom(true);
      // Failsafe: clear creating state if server never responds
      if (createRoomTimeout) clearTimeout(createRoomTimeout);
      createRoomTimeout = setTimeout(() => {
        if (useRoomStore.getState().isCreatingRoom) {
          useRoomStore.getState().setCreatingRoom(false);
          useRoomStore.getState().setError('Room creation timed out. Please try again.');
        }
      }, 15000);
    }
  }, [safeEmit]);

  const joinRoom = useCallback((playerName: string, roomCode: string) => {
    safeEmit('room:join', { playerName, roomCode });
  }, [safeEmit]);

  const leaveRoom = useCallback(() => {
    safeEmit('room:leave');
    clearSession(); // Clear localStorage when intentionally leaving
    useRoomStore.getState().clearRoom();
    useGameStore.getState().reset();
  }, [safeEmit]);

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

  // Game actions — each guards against stale emissions (e.g. double-click)
  // by checking the current phase before emitting. Without this, a second
  // emission after the server has already advanced the phase would clear
  // validActions and leave the player stuck.
  const bid = useCallback((amount: number) => {
    if (useGameStore.getState().gameState?.phase !== 'bidding') return;
    if (safeEmit('game:bid', amount)) {
      useGameStore.getState().setValidActions([]);
    }
  }, [safeEmit]);

  const pass = useCallback(() => {
    if (useGameStore.getState().gameState?.phase !== 'bidding') return;
    if (safeEmit('game:pass')) {
      useGameStore.getState().setValidActions([]);
    }
  }, [safeEmit]);

  const distributeTalon = useCallback((distribution: { playerId: string; card: Card }[]) => {
    if (useGameStore.getState().gameState?.phase !== 'talonDistribution') return;
    if (safeEmit('game:distributeTalon', distribution)) {
      useGameStore.getState().setValidActions([]);
    }
  }, [safeEmit]);

  const playCard = useCallback((card: Card) => {
    if (useGameStore.getState().gameState?.phase !== 'trickPlaying') return;
    if (safeEmit('game:playCard', card)) {
      useGameStore.getState().setValidActions([]);
    }
  }, [safeEmit]);

  const declareMarriage = useCallback((suit: Suit) => {
    if (useGameStore.getState().gameState?.phase !== 'trickPlaying') return;
    safeEmit('game:declareMarriage', suit);
  }, [safeEmit]);

  const confirmTalon = useCallback(() => {
    safeEmit('game:confirmTalon');
  }, [safeEmit]);

  const confirmWykladana = useCallback(() => {
    safeEmit('game:confirmWykladana');
  }, [safeEmit]);

  const playOrPass = useCallback((decision: 'play' | 'pass') => {
    if (useGameStore.getState().gameState?.phase !== 'playOrPassDecision') return;
    if (safeEmit('game:playOrPass', decision)) {
      useGameStore.getState().setValidActions([]);
    }
  }, [safeEmit]);

  const leaveGame = useCallback(() => {
    if (safeEmit('game:leave')) {
      clearSession();
      useRoomStore.getState().clearRoom();
      useGameStore.getState().reset();
    }
  }, [safeEmit]);

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

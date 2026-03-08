import type { Card, Room, ClientGameState, ValidAction, RoundResult, GameStatistics, Suit } from '@tysiac/shared';
import { useGameStore } from '../stores/gameStore.js';
import { useRoomStore } from '../stores/roomStore.js';
import type { SocketLike, SocketDeps } from './types.js';
import { clearCreateRoomTimeout } from './actions.js';

let trickWonTimeout: ReturnType<typeof setTimeout> | null = null;
let marriageClearTimeout: ReturnType<typeof setTimeout> | null = null;
let isAutoReconnecting = false;

/**
 * Register all socket event listeners. Returns a cleanup function
 * that removes every listener and clears internal timeouts.
 */
export function registerSocketListeners(socket: SocketLike, deps: SocketDeps): () => void {

  // --- Connection ---

  socket.on('connect', () => {
    useRoomStore.getState().setConnected(true);
    useRoomStore.getState().setError(null);
    deps.keepAlive.start();

    const storedSession = deps.session.load();
    if (storedSession) {
      isAutoReconnecting = true;
      socket.emit('player:reconnect', {
        roomId: storedSession.roomId,
        playerId: storedSession.playerId,
        sessionToken: storedSession.sessionToken,
      });
    }
  });

  socket.on('disconnect', (reason: string) => {
    useRoomStore.getState().setConnected(false);
    useRoomStore.getState().setCreatingRoom(false);
    if (reason === 'transport close' || reason === 'ping timeout') {
      console.log(`[Socket] Disconnected (${reason}), will auto-reconnect...`);
    }
  });

  socket.on('connect_error', () => {
    useRoomStore.getState().setConnected(false);
  });

  // Track reconnecting state via Socket.io manager events
  (socket as any).io?.on('reconnect_attempt', () => {
    useRoomStore.getState().setConnecting(true);
  });

  (socket as any).io?.on('reconnect', () => {
    useRoomStore.getState().setConnecting(false);
  });

  (socket as any).io?.on('reconnect_failed', () => {
    useRoomStore.getState().setConnecting(false);
  });

  // --- Room events ---

  socket.on('room:created', (room: Room & { sessionToken: string }) => {
    clearCreateRoomTimeout();
    useRoomStore.getState().setCreatingRoom(false);
    useRoomStore.getState().setRoom(room);
    useRoomStore.getState().setPlayerId(room.hostId);

    deps.session.save({
      playerId: room.hostId,
      roomId: room.id,
      sessionToken: room.sessionToken,
      playerName: room.players[0]?.name || 'Player',
    });
  });

  socket.on('room:joined', ({ room, playerId, sessionToken }: { room: Room; playerId: string; sessionToken: string }) => {
    useRoomStore.getState().setRoom(room);
    useRoomStore.getState().setPlayerId(playerId);

    const player = room.players.find(p => p.id === playerId);
    deps.session.save({
      playerId,
      roomId: room.id,
      sessionToken,
      playerName: player?.name || 'Player',
    });
  });

  socket.on('room:updated', (room: Room) => {
    if (useRoomStore.getState().isCreatingRoom) {
      clearCreateRoomTimeout();
      useRoomStore.getState().setCreatingRoom(false);
    }
    useRoomStore.getState().setRoom(room);
  });

  socket.on('room:error', ({ code, message }: { code: string; message: string }) => {
    clearCreateRoomTimeout();
    useRoomStore.getState().setCreatingRoom(false);

    if (code === 'INVALID_SESSION' && isAutoReconnecting) {
      isAutoReconnecting = false;
      deps.session.clear();

      const hasActiveGame = useGameStore.getState().gameState !== null;
      const hasActiveRoom = useRoomStore.getState().room !== null;

      if (hasActiveGame || hasActiveRoom) {
        // Clear stale state so user doesn't get stuck on spinner
        useGameStore.getState().reset();
        useRoomStore.getState().clearRoom();
        useRoomStore.getState().setError('Your session expired. Please rejoin the game.');
      }
      return;
    }

    isAutoReconnecting = false;
    useRoomStore.getState().setError(message);
  });

  // --- Game events ---

  socket.on('game:started', (state: ClientGameState) => {
    useGameStore.getState().reset();
    useGameStore.getState().setGameState(state);
    deps.keepAlive.start();

    const currentRoom = useRoomStore.getState().room;
    if (currentRoom && state?.id) {
      useRoomStore.getState().setRoom({ ...currentRoom, gameId: state.id });
    }
  });

  socket.on('game:stateUpdate', (state: ClientGameState) => {
    useGameStore.getState().setGameState(state);
    if (state?.phase !== 'wykladana') {
      useGameStore.getState().setWykladanaData(null);
    }
  });

  socket.on('game:yourTurn', ({ validActions }: { validActions: ValidAction[] }) => {
    useGameStore.getState().setValidActions(validActions);
    deps.sound.play('yourTurn');
  });

  socket.on('game:roundEnd', (result: RoundResult) => {
    useGameStore.getState().setRoundResult(result);
    deps.sound.play('roundEnd');
  });

  socket.on('game:ended', ({ winnerId, statistics }: { winnerId: string; statistics?: GameStatistics }) => {
    deps.keepAlive.stop();
    useGameStore.getState().setShowGameEnd(true);
    if (statistics) {
      useGameStore.getState().setGameStatistics(statistics);
    }
    deps.sound.play('gameWin');
  });

  socket.on('game:cardPlayed', ({ playerId, card }: { playerId: string; card: Card }) => {
    const gs = useGameStore.getState().gameState;
    if (!gs?.round?.currentTrick) return;

    const already = gs.round.currentTrick.cards.some(
      c => c.card.suit === card.suit && c.card.rank === card.rank
    );
    if (already) return;

    deps.sound.play('cardPlay');

    const myId = useRoomStore.getState().playerId;
    const myHand = playerId === myId
      ? gs.myHand.filter(c => !(c.suit === card.suit && c.rank === card.rank))
      : gs.myHand;

    const newCards = [...gs.round.currentTrick.cards, { playerId, card }];
    let nextPlayer = gs.round.currentTrick.currentPlayer;
    if (newCards.length < 3) {
      const players = gs.players;
      const idx = players.findIndex(p => p.id === playerId);
      let nextIdx = (idx + 1) % players.length;
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

  socket.on('game:error', ({ message }: { message: string }) => {
    useRoomStore.getState().setError(message);
  });

  socket.on('game:marriageDeclared', ({ playerId, suit }: { playerId: string; suit: Suit }) => {
    if (marriageClearTimeout) clearTimeout(marriageClearTimeout);
    useGameStore.getState().setLastMarriageDeclared({ playerId, suit });
    // Immediately update trump suit so card glow reflects new marriage
    const gs = useGameStore.getState().gameState;
    if (gs?.round) {
      useGameStore.getState().setGameState({
        ...gs,
        round: { ...gs.round, trumpSuit: suit },
      });
    }
    deps.sound.play('marriage');
  });

  socket.on('game:trickWon', (data: { winnerId: string; cards: Card[]; points: number }) => {
    if (marriageClearTimeout) clearTimeout(marriageClearTimeout);
    marriageClearTimeout = setTimeout(() => useGameStore.getState().setLastMarriageDeclared(null), 1500);
    deps.sound.play('trickWon');

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
    deps.sound.play('wykladana');
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
  });

  // --- Matchmaking ---

  socket.on('matchmaking:searching', ({ playersFound }: { playersFound: number }) => {
    useRoomStore.getState().setSearchPlayerCount(playersFound);
  });

  socket.on('matchmaking:found', ({ room, playerId, sessionToken }: { room: Room; playerId: string; sessionToken: string }) => {
    useRoomStore.getState().setSearching(false);
    useRoomStore.getState().setSearchPlayerCount(0);
    useRoomStore.getState().setRoom(room);
    useRoomStore.getState().setPlayerId(playerId);

    const player = room.players.find(p => p.id === playerId);
    deps.session.save({
      playerId,
      roomId: room.id,
      sessionToken,
      playerName: player?.name || 'Player',
    });
  });

  socket.on('matchmaking:error', ({ message }: { message: string }) => {
    useRoomStore.getState().setSearching(false);
    useRoomStore.getState().setSearchPlayerCount(0);
    useRoomStore.getState().setError(message);
  });

  // --- Emotes ---

  socket.on('game:emoteReceived', ({ playerId, emoteId }: { playerId: string; emoteId: string }) => {
    useGameStore.getState().setEmote(playerId, emoteId);
    setTimeout(() => useGameStore.getState().clearEmote(playerId), 3000);
  });

  // --- Lobby ---

  socket.on('lobby:roomList', (rooms: Room[]) => {
    useRoomStore.getState().setPublicRooms(rooms);
  });

  // --- Reconnection ---

  socket.on('connection:restored', ({ room, gameState, validActions }: { room: Room; gameState?: ClientGameState; validActions?: ValidAction[] }) => {
    isAutoReconnecting = false;

    const storedSession = deps.session.load();
    if (storedSession) {
      useRoomStore.getState().setPlayerId(storedSession.playerId);
    }

    useRoomStore.getState().setRoom(room);
    if (gameState) {
      useGameStore.getState().setGameState(gameState);
      deps.keepAlive.start();
    }
    if (validActions && validActions.length > 0) {
      useGameStore.getState().setValidActions(validActions);
    }
    deps.session.updateTimestamp();
  });

  // --- Cleanup ---

  return () => {
    if (trickWonTimeout) clearTimeout(trickWonTimeout);
    if (marriageClearTimeout) clearTimeout(marriageClearTimeout);

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
    socket.off('matchmaking:searching');
    socket.off('matchmaking:found');
    socket.off('matchmaking:error');
    socket.off('game:emoteReceived');
    socket.off('lobby:roomList');
    socket.off('connection:restored');

    (socket as any).io?.off('reconnect_attempt');
    (socket as any).io?.off('reconnect');
    (socket as any).io?.off('reconnect_failed');
  };
}

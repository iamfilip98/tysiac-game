import type { Card, Suit } from '@tysiac/shared';
import { useGameStore } from '../stores/gameStore.js';
import { useRoomStore } from '../stores/roomStore.js';
import type { EmitFn, SyncSessionAdapter, GameActions } from './types.js';

let createRoomTimeout: ReturnType<typeof setTimeout> | null = null;

/** Called by listeners when room:created / room:updated / room:error arrives */
export function clearCreateRoomTimeout(): void {
  if (createRoomTimeout) {
    clearTimeout(createRoomTimeout);
    createRoomTimeout = null;
  }
}

/**
 * Create all game action functions. Returns a GameActions object
 * and a cleanupActions function that clears internal timeouts.
 */
export function createGameActions(emit: EmitFn, session: SyncSessionAdapter): { actions: GameActions; cleanup: () => void } {

  // Room actions
  function createRoom(playerName: string, roomName: string, isPrivate: boolean, maxPlayers: 3 | 4 = 3): void {
    if (emit('room:create', { playerName, roomName, isPrivate, maxPlayers })) {
      useRoomStore.getState().setCreatingRoom(true);
      clearCreateRoomTimeout();
      createRoomTimeout = setTimeout(() => {
        if (useRoomStore.getState().isCreatingRoom) {
          useRoomStore.getState().setCreatingRoom(false);
          useRoomStore.getState().setError('Room creation timed out. Please try again.');
        }
      }, 15000);
    }
  }

  function joinRoom(playerName: string, roomCode: string): void {
    emit('room:join', { playerName, roomCode });
  }

  function leaveRoom(): void {
    emit('room:leave');
    session.clear();
    useRoomStore.getState().clearRoom();
    useGameStore.getState().reset();
  }

  function setReady(isReady: boolean): void {
    emit('room:ready', isReady);
  }

  function addAI(): void {
    emit('room:addAI');
  }

  function removeAI(aiId: string): void {
    emit('room:removeAI', aiId);
  }

  function startGame(): void {
    emit('room:startGame');
  }

  // Game actions — each guards against stale emissions by checking current phase
  function bid(amount: number): void {
    if (useGameStore.getState().gameState?.phase !== 'bidding') return;
    if (emit('game:bid', amount)) {
      useGameStore.getState().setValidActions([]);
    }
  }

  function pass(): void {
    if (useGameStore.getState().gameState?.phase !== 'bidding') return;
    if (emit('game:pass')) {
      useGameStore.getState().setValidActions([]);
    }
  }

  function distributeTalon(distribution: { playerId: string; card: Card }[]): void {
    if (useGameStore.getState().gameState?.phase !== 'talonDistribution') return;
    if (emit('game:distributeTalon', distribution)) {
      useGameStore.getState().setValidActions([]);
    }
  }

  function playCard(card: Card): void {
    if (useGameStore.getState().gameState?.phase !== 'trickPlaying') return;
    if (emit('game:playCard', card)) {
      useGameStore.getState().setValidActions([]);
    }
  }

  function declareMarriage(suit: Suit): void {
    if (useGameStore.getState().gameState?.phase !== 'trickPlaying') return;
    emit('game:declareMarriage', suit);
  }

  function confirmDistribution(): void {
    emit('game:confirmDistribution');
  }

  function confirmTalon(): void {
    emit('game:confirmTalon');
  }

  function confirmWykladana(): void {
    emit('game:confirmWykladana');
  }

  function playOrPass(decision: 'play' | 'pass'): void {
    if (useGameStore.getState().gameState?.phase !== 'playOrPassDecision') return;
    if (emit('game:playOrPass', decision)) {
      useGameStore.getState().setValidActions([]);
    }
  }

  // Matchmaking actions
  function joinMatchmaking(playerName: string): void {
    if (emit('matchmaking:join', { playerName })) {
      useRoomStore.getState().setSearching(true);
      useRoomStore.getState().setSearchPlayerCount(1);
    }
  }

  function leaveMatchmaking(): void {
    emit('matchmaking:leave');
    useRoomStore.getState().setSearching(false);
    useRoomStore.getState().setSearchPlayerCount(0);
  }

  function leaveGame(): void {
    if (emit('game:leave')) {
      session.clear();
      useRoomStore.getState().clearRoom();
      useGameStore.getState().reset();
    }
  }

  function pauseGame(): void {
    emit('game:pause');
  }

  function resumeGame(): void {
    emit('game:resume');
  }

  function sendEmote(emoteId: string): void {
    if (emit('game:emote', emoteId)) {
      const myId = useRoomStore.getState().playerId;
      if (myId) {
        useGameStore.getState().setEmote(myId, emoteId);
        setTimeout(() => useGameStore.getState().clearEmote(myId), 3000);
      }
    }
  }

  function cleanup(): void {
    clearCreateRoomTimeout();
  }

  const actions: GameActions = {
    createRoom,
    joinRoom,
    leaveRoom,
    setReady,
    addAI,
    removeAI,
    startGame,
    bid,
    pass,
    confirmDistribution,
    confirmTalon,
    confirmWykladana,
    playOrPass,
    distributeTalon,
    playCard,
    declareMarriage,
    joinMatchmaking,
    leaveMatchmaking,
    leaveGame,
    pauseGame,
    resumeGame,
    sendEmote,
  };

  return { actions, cleanup };
}

import { create } from 'zustand';
import type { ClientGameState, ValidAction, Card, Suit, RoundResult } from '@tysiac/shared';

interface GameState {
  gameState: ClientGameState | null;
  validActions: ValidAction[];
  selectedCard: Card | null;
  lastRoundResult: RoundResult | null;
  showRoundResult: boolean;
  showGameEnd: boolean;
  isMyTurn: boolean;
  serverDebug: any | null;
  // Marriage display state
  lastMarriageDeclared: { playerId: string; suit: Suit } | null;
  // WYKLADANA celebration state
  wykladanaData: { playerName: string; bid: number } | null;
  showWykladana: boolean;

  // Actions
  setGameState: (state: ClientGameState | null) => void;
  setValidActions: (actions: ValidAction[]) => void;
  selectCard: (card: Card | null) => void;
  setRoundResult: (result: RoundResult | null) => void;
  setShowRoundResult: (show: boolean) => void;
  setShowGameEnd: (show: boolean) => void;
  setIsMyTurn: (isMyTurn: boolean) => void;
  setServerDebug: (debug: any) => void;
  setLastMarriageDeclared: (data: { playerId: string; suit: Suit } | null) => void;
  setWykladanaData: (data: { playerName: string; bid: number } | null) => void;
  setShowWykladana: (show: boolean) => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  gameState: null,
  validActions: [],
  selectedCard: null,
  lastRoundResult: null,
  showRoundResult: false,
  showGameEnd: false,
  isMyTurn: false,
  serverDebug: null,
  lastMarriageDeclared: null,
  wykladanaData: null,
  showWykladana: false,

  setGameState: (gameState) =>
    set({
      gameState,
      // Clear selection when state changes
      selectedCard: null,
    }),

  setValidActions: (validActions) =>
    set({
      validActions,
      isMyTurn: validActions.length > 0,
    }),

  selectCard: (selectedCard) => set({ selectedCard }),

  setRoundResult: (lastRoundResult) =>
    set({
      lastRoundResult,
      showRoundResult: lastRoundResult !== null,
    }),

  setShowRoundResult: (showRoundResult) => set({ showRoundResult }),

  setShowGameEnd: (showGameEnd) => set({ showGameEnd }),

  setIsMyTurn: (isMyTurn) => set({ isMyTurn }),

  setServerDebug: (serverDebug) => set({ serverDebug }),

  setLastMarriageDeclared: (lastMarriageDeclared) => set({ lastMarriageDeclared }),

  setWykladanaData: (wykladanaData) =>
    set({
      wykladanaData,
      showWykladana: wykladanaData !== null,
    }),

  setShowWykladana: (showWykladana) => set({ showWykladana }),

  reset: () =>
    set({
      gameState: null,
      validActions: [],
      selectedCard: null,
      lastRoundResult: null,
      showRoundResult: false,
      showGameEnd: false,
      isMyTurn: false,
      serverDebug: null,
      lastMarriageDeclared: null,
      wykladanaData: null,
      showWykladana: false,
    }),
}));

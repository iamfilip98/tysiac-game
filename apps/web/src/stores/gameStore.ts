import { create } from 'zustand';
import type { ClientGameState, ValidAction, Card, Suit, RoundResult, GameStatistics } from '@tysiac/shared';

interface GameState {
  gameState: ClientGameState | null;
  validActions: ValidAction[];
  selectedCard: Card | null;
  lastRoundResult: RoundResult | null;
  showRoundResult: boolean;
  showGameEnd: boolean;
  isMyTurn: boolean;
  // Marriage display state
  lastMarriageDeclared: { playerId: string; suit: Suit } | null;
  // WYKLADANA celebration state
  wykladanaData: { playerName: string; bid: number; marriagePoints?: number; cards: Card[] } | null;
  showWykladana: boolean;
  // Game end statistics
  gameStatistics: GameStatistics | null;
  // Notification for player passed at 100
  passedAt100Notification: { playerName: string } | null;
  // Notification for player threw (at >100)
  threwNotification: { playerName: string; bidAmount: number; scoreChanges: Record<string, number> } | null;
  // Pause state notification
  pauseData: { pausedByName: string; pausedAt: number; expiresAt: number } | null;

  // Actions
  setGameState: (state: ClientGameState | null) => void;
  setValidActions: (actions: ValidAction[]) => void;
  selectCard: (card: Card | null) => void;
  setRoundResult: (result: RoundResult | null) => void;
  setShowRoundResult: (show: boolean) => void;
  setShowGameEnd: (show: boolean) => void;
  setIsMyTurn: (isMyTurn: boolean) => void;
  setLastMarriageDeclared: (data: { playerId: string; suit: Suit } | null) => void;
  setWykladanaData: (data: { playerName: string; bid: number; marriagePoints?: number; cards: Card[] } | null) => void;
  setShowWykladana: (show: boolean) => void;
  setGameStatistics: (statistics: GameStatistics | null) => void;
  setPassedAt100Notification: (data: { playerName: string } | null) => void;
  setThrewNotification: (data: { playerName: string; bidAmount: number; scoreChanges: Record<string, number> } | null) => void;
  setPauseData: (data: { pausedByName: string; pausedAt: number; expiresAt: number } | null) => void;
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
  lastMarriageDeclared: null,
  wykladanaData: null,
  showWykladana: false,
  gameStatistics: null,
  passedAt100Notification: null,
  threwNotification: null,
  pauseData: null,

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

  setLastMarriageDeclared: (lastMarriageDeclared) => set({ lastMarriageDeclared }),

  setWykladanaData: (wykladanaData) =>
    set({
      wykladanaData,
      showWykladana: wykladanaData !== null,
    }),

  setShowWykladana: (showWykladana) => set({ showWykladana }),

  setGameStatistics: (gameStatistics) => set({ gameStatistics }),

  setPassedAt100Notification: (passedAt100Notification) => set({ passedAt100Notification }),

  setThrewNotification: (threwNotification) => set({ threwNotification }),

  setPauseData: (pauseData) => set({ pauseData }),

  reset: () =>
    set({
      gameState: null,
      validActions: [],
      selectedCard: null,
      lastRoundResult: null,
      showRoundResult: false,
      showGameEnd: false,
      isMyTurn: false,
      lastMarriageDeclared: null,
      wykladanaData: null,
      showWykladana: false,
      gameStatistics: null,
      passedAt100Notification: null,
      threwNotification: null,
      pauseData: null,
    }),
}));

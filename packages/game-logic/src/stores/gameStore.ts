import { create } from 'zustand';
import type { ClientGameState, ValidAction, Card, Suit, RoundResult, GameStatistics } from '@tysiac/shared';

export interface GameState {
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
  // Trump trick win effect
  trickWonData: { winnerId: string; wasTrumpWin: boolean } | null;
  // Buffered state update while round result modal is open
  pendingGameState: ClientGameState | null;

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
  setTrickWonData: (data: { winnerId: string; wasTrumpWin: boolean } | null) => void;
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
  trickWonData: null,
  pendingGameState: null,

  setGameState: (gameState) =>
    set((state) => {
      // Buffer state updates while round result modal is showing
      if (state.showRoundResult) {
        return { pendingGameState: gameState };
      }
      return { gameState, selectedCard: null, pendingGameState: null };
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

  setShowRoundResult: (showRoundResult) =>
    set((state) => {
      // When closing the modal, flush any buffered game state
      if (!showRoundResult && state.pendingGameState) {
        return {
          showRoundResult,
          gameState: state.pendingGameState,
          pendingGameState: null,
          selectedCard: null,
        };
      }
      return { showRoundResult };
    }),

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

  setTrickWonData: (trickWonData) => set({ trickWonData }),

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
      trickWonData: null,
      pendingGameState: null,
    }),
}));

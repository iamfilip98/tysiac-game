import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlayerStatsPublic } from '@tysiac/shared';

export interface AuthState {
  isAuthenticated: boolean;
  playerId: string | null;
  displayName: string | null;
  email: string | null;
  authToken: string | null;
  stats: PlayerStatsPublic | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setAuth: (data: { playerId: string; displayName: string; email: string; authToken: string }) => void;
  setStats: (stats: PlayerStatsPublic | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      playerId: null,
      displayName: null,
      email: null,
      authToken: null,
      stats: null,
      isLoading: false,
      error: null,

      setAuth: ({ playerId, displayName, email, authToken }) =>
        set({
          isAuthenticated: true,
          playerId,
          displayName,
          email,
          authToken,
          error: null,
        }),

      setStats: (stats) => set({ stats }),

      setLoading: (isLoading) => set({ isLoading }),

      setError: (error) => set({ error, isLoading: false }),

      logout: () =>
        set({
          isAuthenticated: false,
          playerId: null,
          displayName: null,
          email: null,
          authToken: null,
          stats: null,
          error: null,
        }),
    }),
    {
      name: 'tysiac-auth',
      partialize: (state) => ({
        authToken: state.authToken,
        playerId: state.playerId,
        displayName: state.displayName,
        email: state.email,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);

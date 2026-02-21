'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@tysiac/game-logic';
import * as authApi from '@/lib/authApi';
import type { PlayerStatsPublic } from '@tysiac/shared';

export function useAuth() {
  const {
    isAuthenticated,
    playerId,
    displayName,
    email,
    authToken,
    stats,
    isLoading,
    error,
    setAuth,
    setStats,
    setLoading,
    setError,
    logout: storeLogout,
  } = useAuthStore();

  const initializedRef = useRef(false);

  // On mount: validate stored token and load profile
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (!authToken) return;

    setLoading(true);
    authApi.getProfile(authToken)
      .then((profile) => {
        // Re-set auth in case displayName changed server-side
        setAuth({
          playerId: profile.playerId,
          displayName: profile.displayName,
          email: profile.email,
          authToken: authToken,
        });

        const publicStats: PlayerStatsPublic = {
          ...profile.stats,
          winRate: profile.stats.gamesPlayed > 0
            ? Math.round((profile.stats.gamesWon / profile.stats.gamesPlayed) * 100)
            : 0,
        };
        setStats(publicStats);
        setLoading(false);
      })
      .catch(() => {
        // Token expired or invalid — log out
        storeLogout();
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const register = useCallback(async (registerEmail: string, password: string, name: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await authApi.register({ email: registerEmail, password, displayName: name });
      setAuth({
        playerId: result.playerId,
        displayName: result.displayName,
        email: registerEmail,
        authToken: result.authToken,
      });
      // Fresh account — set empty stats
      setStats({
        gamesPlayed: 0, gamesWon: 0, gamesLost: 0, winRate: 0,
        totalBidsWon: 0, totalBidsFailed: 0, totalMarriages: 0,
        highestGameScore: 0, currentWinStreak: 0, longestWinStreak: 0,
        rating: 1000,
      });
      setLoading(false);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [setAuth, setStats, setLoading, setError]);

  const login = useCallback(async (loginEmail: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await authApi.login({ email: loginEmail, password });
      setAuth({
        playerId: result.playerId,
        displayName: result.displayName,
        email: loginEmail,
        authToken: result.authToken,
      });

      // Fetch profile to get stats
      try {
        const profile = await authApi.getProfile(result.authToken);
        const publicStats: PlayerStatsPublic = {
          ...profile.stats,
          winRate: profile.stats.gamesPlayed > 0
            ? Math.round((profile.stats.gamesWon / profile.stats.gamesPlayed) * 100)
            : 0,
        };
        setStats(publicStats);
      } catch {
        // Stats fetch failed — not critical
      }

      setLoading(false);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [setAuth, setStats, setLoading, setError]);

  const logout = useCallback(async () => {
    if (authToken) {
      try {
        await authApi.logout(authToken);
      } catch {
        // Ignore — token may be already expired
      }
    }
    storeLogout();
  }, [authToken, storeLogout]);

  return {
    isAuthenticated,
    playerId,
    displayName,
    email,
    authToken,
    stats,
    isLoading,
    error,
    register,
    login,
    logout,
  };
}

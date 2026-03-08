'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { motion } from 'framer-motion';

interface ActiveGameInfo {
  hasActiveGame: boolean;
  roomId: string;
  roomCode: string;
  roomName: string;
  playerId: string;
  isAIReplaced: boolean;
  hasActiveRound: boolean;
}

interface RejoinBannerProps {
  isConnected: boolean;
  onRejoin: (roomCode: string) => void;
}

export function RejoinBanner({ isConnected, onRejoin }: RejoinBannerProps) {
  const { isSignedIn, getToken } = useAuth();
  const [activeGame, setActiveGame] = useState<ActiveGameInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const checkActiveGame = useCallback(async () => {
    if (!isSignedIn || !isConnected) return;
    try {
      const token = await getToken();
      if (!token) return;
      const API_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
      const res = await fetch(`${API_URL}/active-game`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.hasActiveGame) {
          setActiveGame(data);
        } else {
          setActiveGame(null);
        }
      }
    } catch { /* not critical */ }
  }, [isSignedIn, isConnected, getToken]);

  useEffect(() => {
    checkActiveGame();
  }, [checkActiveGame]);

  const handleLeave = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const API_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
      await fetch(`${API_URL}/active-game`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setActiveGame(null);
    } catch { /* ignore */ }
  };

  if (!activeGame) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-sm mb-4"
    >
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-md p-4">
        <p className="text-amber-200 text-sm font-medium mb-1">
          You have an active game
        </p>
        <p className="text-white/60 text-xs mb-3">
          {activeGame.roomName}
          {activeGame.isAIReplaced && ' — AI is playing for you'}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setIsLoading(true);
              onRejoin(activeGame.roomCode);
            }}
            disabled={isLoading}
            className="flex-1 py-2 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-200 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Rejoining...' : 'Rejoin Game'}
          </button>
          <button
            onClick={handleLeave}
            className="py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 text-sm transition-colors"
          >
            Leave
          </button>
        </div>
      </div>
    </motion.div>
  );
}

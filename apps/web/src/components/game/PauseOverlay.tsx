'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';

interface PauseOverlayProps {
  pausedByName: string;
  pausedAt: number;
  onResume: () => void;
}

export function PauseOverlay({ pausedByName, pausedAt, onResume }: PauseOverlayProps) {
  const [timeRemaining, setTimeRemaining] = useState('');

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const expiresAt = pausedAt + 60 * 60 * 1000; // 1 hour
      const remaining = Math.max(0, expiresAt - now);

      if (remaining === 0) {
        setTimeRemaining('Expired');
        return;
      }

      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [pausedAt]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-table-800/95 border-2 border-amber-500/50 rounded-xl p-8 max-w-md text-center shadow-2xl"
      >
        <div className="text-5xl mb-4">||</div>
        <h2 className="text-2xl font-bold text-amber-400 mb-2">
          Game Paused
        </h2>
        <p className="text-white/70 mb-4">
          {pausedByName} paused the game
        </p>

        <div className="bg-table-950/50 border border-white/[0.06] rounded-lg p-4 mb-6">
          <div className="text-sm text-white/50 mb-1">Time remaining to resume:</div>
          <div className="text-3xl font-mono text-amber-400">
            {timeRemaining}
          </div>
          <div className="text-xs text-white/40 mt-1">
            Game will end if not resumed within 1 hour
          </div>
        </div>

        <Button
          variant="primary"
          onClick={onResume}
          glow
          className="px-8"
        >
          Resume Game
        </Button>

        <p className="text-white/40 text-xs mt-4">
          Any player can resume the game
        </p>
      </motion.div>
    </motion.div>
  );
}

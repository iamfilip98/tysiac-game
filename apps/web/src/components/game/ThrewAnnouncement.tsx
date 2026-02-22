'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ThrewAnnouncementProps {
  data: {
    playerName: string;
    bidAmount: number;
    scoreChanges: Record<string, number>;
  } | null;
  players: { id: string; name: string }[];
  onComplete: () => void;
}

export function ThrewAnnouncement({ data, players, onComplete }: ThrewAnnouncementProps) {
  useEffect(() => {
    if (!data) return;

    const timer = setTimeout(() => {
      onComplete();
    }, 4000);

    return () => clearTimeout(timer);
  }, [data, onComplete]);

  if (!data) return null;

  // Get score changes for display
  const getPlayerName = (playerId: string) => {
    return players.find(p => p.id === playerId)?.name || 'Unknown';
  };

  return (
    <AnimatePresence>
      <motion.div
        key="threw-announcement"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
      >
        <motion.div
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          className="bg-table-800/95 border-2 border-card-red/50 rounded-xl px-8 py-6 shadow-2xl max-w-sm"
        >
          <div className="text-center">
            <div className="text-card-red text-lg font-semibold mb-2">
              {data.playerName} threw at {data.bidAmount}
            </div>
            <div className="text-white/70 text-sm mb-4">
              Score changes:
            </div>
            <div className="space-y-1">
              {Object.entries(data.scoreChanges).map(([playerId, change]) => (
                <div
                  key={playerId}
                  className={`text-sm ${change >= 0 ? 'text-gold-400' : 'text-card-red'}`}
                >
                  {getPlayerName(playerId)}: {change >= 0 ? '+' : ''}{change}
                </div>
              ))}
            </div>
            <div className="text-white/50 text-xs mt-4">
              Starting new round...
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

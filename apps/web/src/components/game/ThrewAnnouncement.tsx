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

  const getPlayerName = (playerId: string) => {
    return players.find(p => p.id === playerId)?.name || 'Unknown';
  };

  return (
    <AnimatePresence>
      {data && (
        <motion.div
          key="threw-announcement"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-gradient-to-b from-table-800/90 to-table-900/90 backdrop-blur-md border border-white/[0.08] rounded-xl p-4 min-w-[280px] max-w-sm"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}
          >
            <div className="text-center mb-3">
              <div className="text-sm text-white/60 mb-1">Bid abandoned</div>
              <div className="text-lg font-bold text-card-red">
                {data.playerName} threw at {data.bidAmount}
              </div>
            </div>
            <div className="space-y-1">
              {Object.entries(data.scoreChanges).map(([playerId, change]) => (
                <div
                  key={playerId}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-white/70">{getPlayerName(playerId)}</span>
                  <span className={change >= 0 ? 'text-gold-400 font-medium' : 'text-card-red font-medium'}>
                    {change >= 0 ? '+' : ''}{change}
                  </span>
                </div>
              ))}
            </div>
            <div className="text-white/50 text-xs mt-3 text-center">
              Starting new round...
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

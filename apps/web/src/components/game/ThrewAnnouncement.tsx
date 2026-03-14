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

  // Get score changes for display
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
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.3, type: 'spring', damping: 20 }}
            className="relative overflow-hidden rounded-xl min-w-[280px] max-w-sm bg-gradient-to-b from-table-800/95 to-table-900/95 backdrop-blur-md border-2 border-card-red/50"
            style={{
              boxShadow: '0 0 15px rgba(239, 68, 68, 0.25), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            <div className="relative px-8 py-5">
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
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

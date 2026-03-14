'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PassedAt100AnnouncementProps {
  playerName: string | null;
  onComplete: () => void;
}

export function PassedAt100Announcement({ playerName, onComplete }: PassedAt100AnnouncementProps) {
  useEffect(() => {
    if (!playerName) return;

    const timer = setTimeout(() => {
      onComplete();
    }, 3000);

    return () => clearTimeout(timer);
  }, [playerName, onComplete]);

  return (
    <AnimatePresence>
      {playerName && (
        <motion.div
          key="passed-at-100"
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
            className="bg-gradient-to-b from-table-800/90 to-table-900/90 backdrop-blur-md border border-white/[0.08] rounded-xl p-4 min-w-[280px]"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}
          >
            <div className="text-center">
              <div className="text-sm text-white/60 mb-1">All players passed</div>
              <div className="text-lg font-bold text-gold-400">
                {playerName} passed at 100
              </div>
              <div className="text-white/50 text-xs mt-2">
                Starting new round...
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

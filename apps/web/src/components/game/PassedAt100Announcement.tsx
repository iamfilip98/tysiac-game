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

  if (!playerName) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="passed-at-100"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
      >
        <motion.div
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          className="bg-table-800/95 border-2 border-gold-500/50 rounded-xl px-8 py-6 shadow-2xl"
        >
          <div className="text-center">
            <div className="text-gold-400 text-lg font-semibold mb-2">
              {playerName} passed at 100
            </div>
            <div className="text-white/70 text-sm">
              Starting new round...
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

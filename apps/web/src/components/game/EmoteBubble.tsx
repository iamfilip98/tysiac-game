'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { EmoteType } from '@tysiac/shared';
import { EMOTE_LABELS } from '@tysiac/shared';

interface EmoteBubbleProps {
  emote: { playerName: string; emoteType: EmoteType } | null;
  position?: 'left' | 'right' | 'top';
}

const positionStyles: Record<string, string> = {
  left: 'bottom-full left-0 mb-2',
  right: 'bottom-full right-0 mb-2',
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
};

const originMap: Record<string, string> = {
  left: 'origin-bottom-left',
  right: 'origin-bottom-right',
  top: 'origin-bottom',
};

export function EmoteBubble({ emote, position = 'top' }: EmoteBubbleProps) {
  const isEmoji = emote?.emoteType
    ? !['nice-bid', 'oops', 'good-game', 'hurry-up', 'wow', 'sorry'].includes(
        emote.emoteType
      )
    : false;

  return (
    <AnimatePresence>
      {emote && (
        <motion.div
          key={`${emote.playerName}-${emote.emoteType}-${Date.now()}`}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{
            enter: { type: 'spring', damping: 20, stiffness: 300 },
            exit: { duration: 0.3 },
          }}
          className={`absolute ${positionStyles[position]} ${originMap[position]} pointer-events-none z-50`}
        >
          <div className="bg-table-900/95 backdrop-blur border border-table-600 rounded-xl px-3 py-2 shadow-xl whitespace-nowrap">
            {isEmoji ? (
              <span className="text-2xl">{emote.emoteType}</span>
            ) : (
              <div className="flex flex-col items-center">
                <span className="text-xs text-white/50">{emote.playerName}</span>
                <span className="text-sm font-medium text-white">
                  {EMOTE_LABELS[emote.emoteType]}
                </span>
              </div>
            )}
          </div>
          {/* Speech bubble tail */}
          <div
            className={`absolute top-full ${
              position === 'left'
                ? 'left-4'
                : position === 'right'
                ? 'right-4'
                : 'left-1/2 -translate-x-1/2'
            }`}
          >
            <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-table-600" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

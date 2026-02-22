'use client';

import { motion } from 'framer-motion';
import { EMOTE_MAP } from './EmoteButton';

interface EmoteBubbleProps {
  emoteId: string;
  playerName: string;
}

export function EmoteBubble({ emoteId, playerName }: EmoteBubbleProps) {
  const emote = EMOTE_MAP[emoteId];
  if (!emote) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: -4 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="pointer-events-none flex items-center gap-1.5 bg-table-800/90 border border-white/[0.1] rounded-full px-3 py-1 shadow-lg"
    >
      <span className="text-base leading-none">{emote.emoji}</span>
      <span className="text-[11px] text-white/70 font-medium whitespace-nowrap">{emote.label}</span>
    </motion.div>
  );
}

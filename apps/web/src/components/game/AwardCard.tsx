'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { GameAward } from '@tysiac/shared';

interface AwardCardProps {
  award: GameAward;
  playerName: string;
  index: number;
}

export function AwardCard({ award, playerName, index }: AwardCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotateY: -15 }}
      animate={{ opacity: 1, y: 0, rotateY: 0 }}
      transition={{
        type: 'spring',
        damping: 15,
        stiffness: 200,
        delay: index * 0.15,
      }}
      className={cn(
        'relative overflow-hidden rounded-xl p-4',
        'bg-gradient-to-br from-amber-900/40 via-yellow-800/30 to-amber-900/40',
        'border border-gold-500/30',
        'shadow-lg shadow-gold-500/10'
      )}
    >
      {/* Decorative corner accents */}
      <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-gold-400/50 rounded-tl-lg" />
      <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-gold-400/50 rounded-tr-lg" />
      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-gold-400/50 rounded-bl-lg" />
      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-gold-400/50 rounded-br-lg" />

      {/* Shimmer effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-gold-400/10 to-transparent"
        initial={{ x: '-100%' }}
        animate={{ x: '200%' }}
        transition={{
          duration: 2,
          delay: index * 0.15 + 0.5,
          ease: 'easeInOut',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center gap-2">
        {/* Emoji */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            type: 'spring',
            damping: 10,
            delay: index * 0.15 + 0.2,
          }}
          className="text-4xl"
        >
          {award.emoji}
        </motion.div>

        {/* Title - Bilingual */}
        <div>
          <h3 className="text-lg font-bold text-gold-400">{award.titleEn}</h3>
          <p className="text-sm text-gold-500/70 italic">{award.titlePl}</p>
        </div>

        {/* Player name */}
        <p className="text-white font-medium">{playerName}</p>

        {/* Description */}
        <p className="text-sm text-white/60">{award.description}</p>
      </div>
    </motion.div>
  );
}

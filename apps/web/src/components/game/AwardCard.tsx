'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { GameAward } from '@tysiac/shared';

function AwardIcon({ emoji }: { emoji: string }) {
  if (emoji === '🛢️') {
    return (
      <svg className="w-10 h-10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M4 3 Q3 8 4 13 L12 13 Q13 8 12 3 Z" fill="#1a1a1a" stroke="#d4af37" strokeWidth="0.7" />
        <path d="M3.8 4.5 Q8 4 12.2 4.5" fill="none" stroke="#d4af37" strokeWidth="0.8" />
        <path d="M3.5 8 Q8 7.3 12.5 8" fill="none" stroke="#d4af37" strokeWidth="0.8" />
        <path d="M3.8 11.5 Q8 12 12.2 11.5" fill="none" stroke="#d4af37" strokeWidth="0.8" />
        <ellipse cx="8" cy="3" rx="4" ry="1.3" fill="#1a1a1a" stroke="#d4af37" strokeWidth="0.7" />
        <ellipse cx="7.5" cy="2.8" rx="2" ry="0.5" fill="rgba(255,255,255,0.08)" />
        <line x1="6" y1="4.5" x2="5.8" y2="11.5" stroke="rgba(212,175,55,0.2)" strokeWidth="0.4" />
        <line x1="10" y1="4.5" x2="10.2" y2="11.5" stroke="rgba(212,175,55,0.2)" strokeWidth="0.4" />
      </svg>
    );
  }
  if (emoji === '🏰') {
    return (
      <svg className="w-10 h-10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1" y="4" width="3.5" height="12" fill="#1a1a1a" stroke="#d4af37" strokeWidth="0.6" />
        <polygon points="1,4 2.75,1 4.5,4" fill="#1a1a1a" stroke="#d4af37" strokeWidth="0.6" />
        <rect x="2" y="6" width="0.8" height="0.8" fill="#d4af37" opacity="0.5" />
        <rect x="11.5" y="4" width="3.5" height="12" fill="#1a1a1a" stroke="#d4af37" strokeWidth="0.6" />
        <polygon points="11.5,4 13.25,1 15,4" fill="#1a1a1a" stroke="#d4af37" strokeWidth="0.6" />
        <rect x="13.2" y="6" width="0.8" height="0.8" fill="#d4af37" opacity="0.5" />
        <rect x="4.5" y="6" width="7" height="10" fill="#1a1a1a" stroke="#d4af37" strokeWidth="0.6" />
        <rect x="5" y="4.5" width="1.5" height="1.5" fill="#1a1a1a" stroke="#d4af37" strokeWidth="0.5" />
        <rect x="7.25" y="4.5" width="1.5" height="1.5" fill="#1a1a1a" stroke="#d4af37" strokeWidth="0.5" />
        <rect x="9.5" y="4.5" width="1.5" height="1.5" fill="#1a1a1a" stroke="#d4af37" strokeWidth="0.5" />
        <path d="M6.5 16 V12 Q6.5 9.5 8 9.5 Q9.5 9.5 9.5 12 V16" fill="#d4af37" stroke="#b8941f" strokeWidth="0.4" />
      </svg>
    );
  }
  return <span className="text-4xl">{emoji}</span>;
}

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
          className="text-4xl flex items-center justify-center"
        >
          <AwardIcon emoji={award.emoji} />
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

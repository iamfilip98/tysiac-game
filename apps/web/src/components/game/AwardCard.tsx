'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { GameAward } from '@tysiac/shared';

function AwardIcon({ emoji }: { emoji: string }) {
  if (emoji === '🛢️') {
    return (
      <svg className="w-10 h-10" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="9" fill="#1a1a1a" />
        <path d="M10,10 L19,10 A9,9 0 0,1 16.36,16.36Z" fill="#d4af37" />
        <path d="M10,10 L10,19 A9,9 0 0,1 3.64,16.36Z" fill="#d4af37" />
        <path d="M10,10 L1,10 A9,9 0 0,1 3.64,3.64Z" fill="#d4af37" />
        <path d="M10,10 L10,1 A9,9 0 0,1 16.36,3.64Z" fill="#d4af37" />
        <circle cx="16.9" cy="12.9" r="1.1" fill="#1a1a1a" />
        <circle cx="7.1" cy="16.9" r="1.1" fill="#1a1a1a" />
        <circle cx="3.1" cy="7.1" r="1.1" fill="#1a1a1a" />
        <circle cx="12.9" cy="3.1" r="1.1" fill="#1a1a1a" />
        <circle cx="10" cy="10" r="8.7" fill="none" stroke="#b8941f" strokeWidth="0.6" />
        <circle cx="10" cy="10" r="5.8" fill="#1a1a1a" stroke="#d4af37" strokeWidth="0.4" />
        <circle cx="10" cy="10" r="4.8" fill="#d4af37" />
        <path d="M8.2 7 Q7.4 10 8.2 13 L11.8 13 Q12.6 10 11.8 7 Z" fill="#1a1a1a" />
        <ellipse cx="10" cy="7" rx="1.8" ry="0.7" fill="#1a1a1a" />
        <line x1="7.9" y1="8.5" x2="12.1" y2="8.5" stroke="#d4af37" strokeWidth="0.5" strokeLinecap="round" />
        <line x1="7.7" y1="10" x2="12.3" y2="10" stroke="#d4af37" strokeWidth="0.5" strokeLinecap="round" />
        <line x1="7.9" y1="11.5" x2="12.1" y2="11.5" stroke="#d4af37" strokeWidth="0.5" strokeLinecap="round" />
        <ellipse cx="9" cy="8.5" rx="3" ry="2.5" fill="rgba(255,255,255,0.12)" />
        <circle cx="10" cy="10" r="4.8" fill="none" stroke="#b8941f" strokeWidth="0.3" />
      </svg>
    );
  }
  if (emoji === '🏰') {
    return (
      <svg className="w-10 h-10" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="9" fill="#1a1a1a" />
        <path d="M10,10 L19,10 A9,9 0 0,1 16.36,16.36Z" fill="#d4af37" />
        <path d="M10,10 L10,19 A9,9 0 0,1 3.64,16.36Z" fill="#d4af37" />
        <path d="M10,10 L1,10 A9,9 0 0,1 3.64,3.64Z" fill="#d4af37" />
        <path d="M10,10 L10,1 A9,9 0 0,1 16.36,3.64Z" fill="#d4af37" />
        <circle cx="16.9" cy="12.9" r="1.1" fill="#1a1a1a" />
        <circle cx="7.1" cy="16.9" r="1.1" fill="#1a1a1a" />
        <circle cx="3.1" cy="7.1" r="1.1" fill="#1a1a1a" />
        <circle cx="12.9" cy="3.1" r="1.1" fill="#1a1a1a" />
        <circle cx="10" cy="10" r="8.7" fill="none" stroke="#b8941f" strokeWidth="0.6" />
        <circle cx="10" cy="10" r="5.8" fill="#1a1a1a" stroke="#d4af37" strokeWidth="0.4" />
        <circle cx="10" cy="10" r="4.8" fill="#d4af37" />
        <rect x="6.8" y="7.5" width="2.4" height="6" fill="#1a1a1a" />
        <rect x="10.8" y="7.5" width="2.4" height="6" fill="#1a1a1a" />
        <rect x="9.2" y="9" width="1.6" height="4.5" fill="#1a1a1a" />
        <rect x="6.8" y="6.5" width="0.9" height="1" fill="#1a1a1a" />
        <rect x="8.3" y="6.5" width="0.9" height="1" fill="#1a1a1a" />
        <rect x="10.8" y="6.5" width="0.9" height="1" fill="#1a1a1a" />
        <rect x="12.3" y="6.5" width="0.9" height="1" fill="#1a1a1a" />
        <path d="M9.3 13.5 V11.5 Q9.3 10.3 10 10.3 Q10.7 10.3 10.7 11.5 V13.5" fill="#d4af37" />
        <ellipse cx="9" cy="8.5" rx="3" ry="2.5" fill="rgba(255,255,255,0.12)" />
        <circle cx="10" cy="10" r="4.8" fill="none" stroke="#b8941f" strokeWidth="0.3" />
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

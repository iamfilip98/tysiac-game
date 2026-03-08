'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// Smooth easing for all devices (no springs)
const smoothTransition = { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] };

interface OpponentHandProps {
  cardCount: number;
  position: 'left' | 'right' | 'top';
  playerName: string;
  isCurrentTurn?: boolean;
}

export const OpponentHand = memo(function OpponentHand({
  cardCount,
  position,
  playerName,
  isCurrentTurn = false,
}: OpponentHandProps) {
  const positionClasses = {
    left: 'flex-col items-start',
    right: 'flex-col items-end',
    top: 'flex-row items-center',
  };

  const cardDirection = position === 'top' ? 'horizontal' : 'vertical';

  return (
    <div
      className={cn('flex gap-2', positionClasses[position])}
      role="group"
      aria-label={`${playerName}'s hand: ${cardCount} cards${isCurrentTurn ? '. Their turn.' : ''}`}
    >
      {/* Player name */}
      <div
        className={cn(
          'text-sm font-medium px-2 py-1 rounded-lg truncate max-w-[5.5rem] sm:max-w-[8rem] lg:max-w-[12rem]',
          isCurrentTurn
            ? 'text-gold-400 bg-gold-500/10 border border-gold-500/40 shadow-[0_0_12px_rgba(251,191,36,0.2)]'
            : 'text-white/80 bg-table-800/80 border border-white/[0.06]'
        )}
        title={playerName}
      >
        {playerName}
        {isCurrentTurn && <span className="sr-only"> (their turn)</span>}
      </div>

      {/* Cards */}
      <div
        className={cn(
          'relative flex',
          cardDirection === 'vertical' ? 'flex-col -space-y-6 sm:-space-y-8' : '-space-x-4 sm:-space-x-6'
        )}
        aria-hidden="true"
      >
        {Array.from({ length: cardCount }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ ...smoothTransition, delay: i * 0.02 }}
            className={cn(
              'w-7 h-10 sm:w-10 sm:h-14 rounded-md card-back',
              cardDirection === 'vertical' && 'rotate-90'
            )}
            style={{
              boxShadow: '0 2px 4px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
            }}
          />
        ))}
      </div>
    </div>
  );
});

'use client';

import { motion } from 'framer-motion';
import { cn, truncateName } from '@/lib/utils';
import { useScreenSize } from '@/hooks/useIsMobile';

// Smooth easing for all devices (no springs)
const smoothTransition = { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] };

interface OpponentHandProps {
  cardCount: number;
  position: 'left' | 'right' | 'top';
  playerName: string;
  isCurrentTurn?: boolean;
}

export function OpponentHand({
  cardCount,
  position,
  playerName,
  isCurrentTurn = false,
}: OpponentHandProps) {
  const { isMobile } = useScreenSize();

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
          'text-sm font-medium px-2 py-1 rounded-lg bg-table-800/80 border border-white/[0.06]',
          isCurrentTurn ? 'text-gold-400 ring-2 ring-gold-400/50' : 'text-white/80'
        )}
        title={playerName}
      >
        {truncateName(playerName)}
        {isCurrentTurn && (
          <motion.span
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="ml-2"
            aria-hidden="true"
          >
            •
          </motion.span>
        )}
        {isCurrentTurn && <span className="sr-only"> (their turn)</span>}
      </div>

      {/* Cards */}
      <div
        className={cn(
          'flex',
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
            style={{ willChange: 'opacity' }}
          />
        ))}
      </div>
    </div>
  );
}

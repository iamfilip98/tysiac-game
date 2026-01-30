'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from './Card';
import { cn } from '@/lib/utils';
import type { Card as CardType } from '@tysiac/shared';

// Hook to track screen size
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

interface TrickPileProps {
  cards: { playerId: string; card: CardType }[];
  players: { id: string; name: string; seatIndex: number }[];
  currentPlayerId: string; // The viewing player
}

export function TrickPile({ cards, players, currentPlayerId }: TrickPileProps) {
  const isMobile = useIsMobile();

  // Position cards based on who played them relative to current player
  const getCardPosition = (playerId: string) => {
    const currentIndex = players.findIndex((p) => p.id === currentPlayerId);
    const playerIndex = players.findIndex((p) => p.id === playerId);
    const relativePosition = (playerIndex - currentIndex + 3) % 3;

    // Responsive positions: 0 = self (bottom), 1 = left, 2 = right
    const positions = isMobile
      ? [
          { x: 0, y: 30, rotate: 0 },     // Self (bottom)
          { x: -40, y: -15, rotate: -10 }, // Left
          { x: 40, y: -15, rotate: 10 },   // Right
        ]
      : [
          { x: 0, y: 40, rotate: 0 },     // Self (bottom)
          { x: -60, y: -20, rotate: -15 }, // Left
          { x: 60, y: -20, rotate: 15 },   // Right
        ];

    return positions[relativePosition];
  };

  return (
    <div className={cn(
      'relative flex items-center justify-center',
      isMobile ? 'w-36 h-36' : 'w-48 h-48'
    )}>
      {/* Table felt center */}
      <div className="absolute inset-4 rounded-full bg-table-800/50 border border-table-600/30" />

      {/* Cards */}
      <AnimatePresence>
        {cards.map(({ playerId, card }, index) => {
          const position = getCardPosition(playerId);
          const player = players.find((p) => p.id === playerId);

          return (
            <motion.div
              key={`${card.suit}-${card.rank}`}
              initial={{
                opacity: 0,
                scale: 0.5,
                x: position.x * 3,
                y: position.y * 3,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                x: position.x,
                y: position.y,
                rotate: position.rotate,
              }}
              exit={{
                opacity: 0,
                scale: 0.8,
                y: -100,
              }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 25,
              }}
              className="absolute"
              style={{ zIndex: index }}
            >
              <Card card={card} size={isMobile ? 'sm' : 'md'} isPlayable={false} />
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Empty state */}
      {cards.length === 0 && (
        <div className="text-white/30 text-sm">Play a card</div>
      )}
    </div>
  );
}

// Won tricks pile (minimized display)
interface WonTricksPileProps {
  tricksCount: number;
  points: number;
  className?: string;
}

export function WonTricksPile({ tricksCount, points, className }: WonTricksPileProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Stacked cards visual */}
      <div className="relative w-8 h-8">
        {Array.from({ length: Math.min(tricksCount, 3) }).map((_, i) => (
          <div
            key={i}
            className="absolute w-6 h-8 rounded bg-gradient-to-br from-white to-gray-200 border border-gray-300"
            style={{
              top: i * 2,
              left: i * 2,
              transform: `rotate(${i * 5}deg)`,
            }}
          />
        ))}
      </div>

      {/* Count and points */}
      <div className="text-sm">
        <div className="text-white font-medium">{tricksCount} tricks</div>
        <div className="text-white/60">{points} pts</div>
      </div>
    </div>
  );
}

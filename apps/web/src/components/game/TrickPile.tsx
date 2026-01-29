'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Card } from './Card';
import { cn } from '@/lib/utils';
import type { Card as CardType } from '@tysiac/shared';

interface TrickPileProps {
  cards: { playerId: string; card: CardType }[];
  players: { id: string; name: string; seatIndex: number }[];
  currentPlayerId: string; // The viewing player
}

export function TrickPile({ cards, players, currentPlayerId }: TrickPileProps) {
  // Position cards based on who played them relative to current player
  const getCardPosition = (playerId: string) => {
    const currentIndex = players.findIndex((p) => p.id === currentPlayerId);
    const playerIndex = players.findIndex((p) => p.id === playerId);
    const relativePosition = (playerIndex - currentIndex + 3) % 3;

    // 0 = self (bottom), 1 = left, 2 = right
    const positions = [
      { x: 0, y: 40, rotate: 0 },     // Self (bottom)
      { x: -60, y: -20, rotate: -15 }, // Left
      { x: 60, y: -20, rotate: 15 },   // Right
    ];

    return positions[relativePosition];
  };

  return (
    <div className="relative w-48 h-48 flex items-center justify-center">
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
              <Card card={card} size="md" isPlayable={false} />
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

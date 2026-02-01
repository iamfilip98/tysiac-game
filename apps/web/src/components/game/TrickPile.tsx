'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from './Card';
import { cn } from '@/lib/utils';
import type { Card as CardType, Suit } from '@tysiac/shared';

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
  marriageCard?: { suit: Suit } | null; // If a marriage was just declared, show Q as gold
  isSpectating?: boolean; // Whether the viewer is spectating (dealer in 4-player mode)
}

export function TrickPile({ cards, players, currentPlayerId, marriageCard, isSpectating }: TrickPileProps) {
  const isMobile = useIsMobile();

  // Position cards based on who played them relative to current player
  const getCardPosition = (playerId: string) => {
    // Responsive positions: 0 = left, 1 = right, 2 = bottom (for spectating)
    // or 0 = self (bottom), 1 = left, 2 = right (for active player)
    const spectatorPositions = isMobile
      ? [
          { x: -40, y: -15, rotate: -10 }, // Position 0 = left
          { x: 40, y: -15, rotate: 10 },   // Position 1 = right
          { x: 0, y: 30, rotate: 0 },      // Position 2 = bottom
        ]
      : [
          { x: -60, y: -20, rotate: -15 }, // Position 0 = left
          { x: 60, y: -20, rotate: 15 },   // Position 1 = right
          { x: 0, y: 40, rotate: 0 },      // Position 2 = bottom
        ];

    const activePositions = isMobile
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

    // When spectating, use fixed position mapping based on player index in the players array
    // players[0] = left, players[1] = right, players[2] = bottom (matches GameBoard otherPlayers layout)
    if (isSpectating) {
      const playerIndex = players.findIndex((p) => p.id === playerId);
      if (playerIndex === -1) return spectatorPositions[0];
      return spectatorPositions[playerIndex];
    }

    // For active players, use relative position calculation
    let currentIndex = players.findIndex((p) => p.id === currentPlayerId);
    if (currentIndex === -1) {
      currentIndex = 0;
    }

    const playerIndex = players.findIndex((p) => p.id === playerId);
    const relativePosition = (playerIndex - currentIndex + 3) % 3;

    return activePositions[relativePosition];
  };

  return (
    <div className={cn(
      'relative flex items-center justify-center',
      isMobile ? 'w-36 h-36' : 'w-48 h-48'
    )}>
      {/* Table felt center */}
      <div className="absolute inset-4 rounded-full bg-table-800/50 border border-table-600/30" />

      {/* Gold sparkle effect when marriage declared */}
      {marriageCard && (
        <motion.div
          className="absolute inset-4 rounded-full pointer-events-none"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.7, 0.3, 0.7],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{
            background: 'radial-gradient(circle, rgba(251,191,36,0.4) 0%, transparent 70%)',
            boxShadow: '0 0 25px 8px rgba(251,191,36,0.5)',
          }}
        />
      )}

      {/* Cards */}
      <AnimatePresence>
        {cards.map(({ playerId, card }, index) => {
          const position = getCardPosition(playerId);
          const player = players.find((p) => p.id === playerId);

          // Simpler transitions for mobile
          const transition = isMobile
            ? { duration: 0.2, ease: 'easeOut' }
            : { type: 'spring', stiffness: 300, damping: 25 };

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
              transition={transition}
              className="absolute will-change-transform"
              style={{ zIndex: index, transform: 'translateZ(0)' }}
            >
              <Card
                card={card}
                size={isMobile ? 'sm' : 'md'}
                isPlayable={false}
                isMarriageCard={marriageCard?.suit === card.suit && card.rank === 'Q'}
              />
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

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Card } from './Card';
import { cn } from '@/lib/utils';
import { useScreenSize } from '@/hooks/useIsMobile';
import { usePreferencesStore } from '@/stores/preferencesStore';
import type { Card as CardType, Suit } from '@tysiac/shared';

interface TrickPileProps {
  cards: { playerId: string; card: CardType }[];
  players: { id: string; name: string; seatIndex: number }[];
  currentPlayerId: string; // The viewing player
  marriageCard?: { suit: Suit } | null; // If a marriage was just declared, show Q as gold
  isSpectating?: boolean; // Whether the viewer is spectating (dealer in 4-player mode)
  trumpWin?: boolean; // Show sparkle effect when trump wins the trick
  trumpSuit?: Suit | null; // Current trump suit for blue glow on trump cards
}

export function TrickPile({ cards, players, currentPlayerId, marriageCard, isSpectating, trumpWin, trumpSuit }: TrickPileProps) {
  const { isMobile, height } = useScreenSize();
  const animationsEnabled = usePreferencesStore((s) => s.animationsEnabled);

  // Card size tier based on viewport height:
  // - Short mobile (<700px): 'sm' (56×84) — original compact size
  // - Tall mobile (>=700px): 'md' (64×96)
  // - Desktop: 'lg' (80×120)
  const sizeTier = !isMobile ? 'lg' : height < 700 ? 'sm' : 'md';

  // Position cards based on who played them relative to current player
  const getCardPosition = (playerId: string) => {
    // Spread distances scale with card size tier
    const spreads = {
      sm: { x: 40, yUp: -28, yDown: 42, rot: 8 },
      md: { x: 48, yUp: -34, yDown: 50, rot: 10 },
      lg: { x: 72, yUp: -36, yDown: 58, rot: 15 },
    };
    const s = spreads[sizeTier];

    const spectatorPositions = [
      { x: -s.x, y: s.yUp, rotate: -s.rot },  // Position 0 = left
      { x: s.x, y: s.yUp, rotate: s.rot },     // Position 1 = right
      { x: 0, y: s.yDown, rotate: 0 },          // Position 2 = bottom
    ];

    const activePositions = [
      { x: 0, y: s.yDown, rotate: 0 },          // Self (bottom)
      { x: -s.x, y: s.yUp, rotate: -s.rot },   // Left
      { x: s.x, y: s.yUp, rotate: s.rot },      // Right
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
      sizeTier === 'sm' ? 'w-44 h-44' : sizeTier === 'md' ? 'w-52 h-56' : 'w-64 h-64'
    )}>
      {/* Table felt center */}
      <div className="absolute inset-4 rounded-full" style={{
        background: 'radial-gradient(circle, rgb(var(--table-700) / 0.4) 0%, rgb(var(--table-800) / 0.5) 60%, transparent 100%)',
        boxShadow: 'inset 0 0 20px rgba(0,0,0,0.2), 0 0 15px rgb(var(--table-600) / 0.1)',
      }} />

      {/* Marriage declared indicator */}
      {marriageCard && (
        animationsEnabled ? (
          <>
            {/* Outer rotating ring */}
            <motion.div
              className="absolute inset-2 rounded-full pointer-events-none"
              initial={{ rotate: 0, opacity: 0 }}
              animate={{ rotate: 360, opacity: 1 }}
              transition={{
                rotate: { duration: 8, repeat: Infinity, ease: 'linear' },
                opacity: { duration: 0.5 },
              }}
              style={{
                background: `conic-gradient(
                  from 0deg,
                  transparent 0deg,
                  rgba(212, 175, 55, 0.6) 30deg,
                  rgba(245, 231, 163, 0.8) 60deg,
                  rgba(212, 175, 55, 0.6) 90deg,
                  transparent 120deg,
                  transparent 180deg,
                  rgba(212, 175, 55, 0.6) 210deg,
                  rgba(245, 231, 163, 0.8) 240deg,
                  rgba(212, 175, 55, 0.6) 270deg,
                  transparent 300deg,
                  transparent 360deg
                )`,
                WebkitMask: 'radial-gradient(transparent 60%, black 65%, black 100%)',
                mask: 'radial-gradient(transparent 60%, black 65%, black 100%)',
              }}
            />
            {/* Inner glow pulse */}
            <motion.div
              className="absolute inset-6 rounded-full pointer-events-none"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.4, 0.7, 0.4],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              style={{
                background: 'radial-gradient(circle, rgba(212, 175, 55, 0.5) 0%, rgba(245, 231, 163, 0.3) 40%, transparent 70%)',
                boxShadow: '0 0 30px 10px rgba(212, 175, 55, 0.4)',
              }}
            />
            {/* Floating sparkle particles */}
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1.5 h-1.5 rounded-full pointer-events-none"
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0, 1, 0],
                  x: Math.cos((i * 45 * Math.PI) / 180) * (sizeTier === 'lg' ? 90 : sizeTier === 'md' ? 65 : 55),
                  y: Math.sin((i * 45 * Math.PI) / 180) * (sizeTier === 'lg' ? 90 : sizeTier === 'md' ? 65 : 55),
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.25,
                  ease: 'easeOut',
                }}
                style={{
                  left: '50%',
                  top: '50%',
                  marginLeft: '-3px',
                  marginTop: '-3px',
                  background: 'radial-gradient(circle, #fff 0%, #f5e7a3 50%, #d4af37 100%)',
                  boxShadow: '0 0 8px 2px rgba(245, 231, 163, 0.8)',
                }}
              />
            ))}
          </>
        ) : (
          /* Static gold border fallback when animations off */
          <div
            className="absolute inset-3 rounded-full pointer-events-none border-2 border-gold-400/60"
            style={{ boxShadow: '0 0 12px 2px rgba(212, 175, 55, 0.3)' }}
          />
        )
      )}

      {/* Trump win sparkle burst */}
      {animationsEnabled && (
        <AnimatePresence>
          {trumpWin && (
            <>
              {/* Glow pulse */}
              <motion.div
                className="absolute inset-4 rounded-full pointer-events-none"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0.3, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                style={{
                  background: 'radial-gradient(circle, rgba(147, 197, 253, 0.6) 0%, rgba(96, 165, 250, 0.3) 40%, transparent 70%)',
                  boxShadow: '0 0 25px 8px rgba(147, 197, 253, 0.4)',
                }}
              />
              {/* Sparkle particles */}
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={`trump-sparkle-${i}`}
                  className="absolute w-1.5 h-1.5 rounded-full pointer-events-none"
                  initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                  animate={{
                    opacity: [0, 1, 0],
                    scale: [0, 1.2, 0],
                    x: Math.cos((i * 45 * Math.PI) / 180) * (sizeTier === 'lg' ? 85 : sizeTier === 'md' ? 60 : 50),
                    y: Math.sin((i * 45 * Math.PI) / 180) * (sizeTier === 'lg' ? 85 : sizeTier === 'md' ? 60 : 50),
                  }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: 0.8,
                    delay: i * 0.05,
                    ease: 'easeOut',
                  }}
                  style={{
                    left: '50%',
                    top: '50%',
                    marginLeft: '-3px',
                    marginTop: '-3px',
                    background: 'radial-gradient(circle, #fff 0%, #93c5fd 50%, #60a5fa 100%)',
                    boxShadow: '0 0 6px 2px rgba(147, 197, 253, 0.8)',
                  }}
                />
              ))}
            </>
          )}
        </AnimatePresence>
      )}

      {/* Cards */}
      <AnimatePresence>
        {cards.map(({ playerId, card }, index) => {
          const position = getCardPosition(playerId);
          const player = players.find((p) => p.id === playerId);

          const transition = { duration: 0.35, ease: 'easeOut' as const };

          return (
            <motion.div
              key={`${card.suit}-${card.rank}`}
              layoutId={`card-${card.suit}-${card.rank}`}
              initial={{
                opacity: 0,
                x: position.x * 2.5,
                y: position.y * 2.5,
              }}
              animate={{
                opacity: 1,
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
                size={sizeTier}
                isPlayable={false}
                isMarriageCard={marriageCard?.suit === card.suit && card.rank === 'Q'}
                isTrumpCard={!!trumpSuit && card.suit === trumpSuit}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Empty state */}
      {cards.length === 0 && (
        <div className="flex flex-col items-center gap-1 text-white/25">
          <svg className="w-8 h-10" viewBox="0 0 32 40" fill="none" aria-hidden="true">
            <rect x="1" y="1" width="30" height="38" rx="3" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
          </svg>
          <span className="text-xs">Play a card</span>
        </div>
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

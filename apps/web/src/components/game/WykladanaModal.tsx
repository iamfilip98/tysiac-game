'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ElectricBorder } from '@/components/ui/ElectricBorder';
import { Card } from './Card';
import { truncateName } from '@/lib/utils';
import type { Card as CardType } from '@tysiac/shared';

interface WykladanaModalProps {
  playerName: string;
  bid: number;
  marriagePoints?: number;
  cards: CardType[];
  onComplete: () => void;
}

// Gold particle effects - premium shimmer particles rising upward
function GoldParticles() {
  const particles = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 2.5 + Math.random() * 2,
    size: 2 + Math.random() * 4,
    drift: (Math.random() - 0.5) * 60,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            bottom: '-10px',
            width: p.size,
            height: p.size,
            background: `radial-gradient(circle, #fcd34d, #d97706)`,
            boxShadow: `0 0 ${p.size * 2}px ${p.size}px rgba(251, 191, 36, 0.3)`,
          }}
          animate={{
            y: [0, -(typeof window !== 'undefined' ? window.innerHeight : 800) - 50],
            x: [0, p.drift],
            opacity: [0, 1, 1, 0],
            scale: [0.5, 1, 1, 0.3],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
}

// Confetti particle component
function Confetti() {
  const colors = ['#fbbf24', '#f59e0b', '#fcd34d', '#d97706', '#fef3c7', '#fff'];
  const particles = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    color: colors[Math.floor(Math.random() * colors.length)],
    x: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 2 + Math.random() * 2,
    size: 8 + Math.random() * 8,
    rotation: Math.random() * 360,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute"
          style={{
            left: `${p.x}%`,
            top: '-20px',
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          }}
          initial={{ y: -20, rotate: 0, opacity: 1 }}
          animate={{
            y: typeof window !== 'undefined' ? window.innerHeight + 50 : 800,
            rotate: p.rotation + 360 * 3,
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: 'easeIn',
          }}
        />
      ))}
    </div>
  );
}

export function WykladanaModal({ playerName, bid, marriagePoints = 0, cards, onComplete }: WykladanaModalProps) {
  const [showButton, setShowButton] = useState(false);
  const [hasConfirmed, setHasConfirmed] = useState(false);

  // Sort cards by suit and rank, ensuring red/black alternation when possible
  // Same logic as PlayerHand.tsx for consistency
  const sortedCards = useMemo(() => {
    const rankOrder = ['A', '10', 'K', 'Q', 'J', '9'];
    const isRedSuit = (suit: string) => suit === 'hearts' || suit === 'diamonds';
    const suitValue: Record<string, number> = { hearts: 100, diamonds: 80, clubs: 60, spades: 40 };

    // Find unique suits in hand
    const suitsInHand = Array.from(new Set(cards.map(c => c.suit)));

    // Determine optimal suit order to avoid same-color adjacency
    let suitOrder: string[];
    if (suitsInHand.length === 3) {
      // With 3 suits, arrange to alternate colors
      // Sort by marriage value (descending) so higher-value suits appear first (on left)
      const redSuits = suitsInHand.filter(isRedSuit).sort((a, b) => suitValue[b] - suitValue[a]);
      const blackSuits = suitsInHand.filter(s => !isRedSuit(s)).sort((a, b) => suitValue[b] - suitValue[a]);

      if (redSuits.length === 2) {
        // 2 red, 1 black: red, black, red
        suitOrder = [redSuits[0], blackSuits[0], redSuits[1]];
      } else if (blackSuits.length === 2) {
        // 2 black, 1 red: black, red, black
        suitOrder = [blackSuits[0], redSuits[0], blackSuits[1]];
      } else {
        // Fallback
        suitOrder = ['hearts', 'clubs', 'diamonds', 'spades'];
      }
    } else {
      // Default order for 4 suits (alternates red/black): hearts, clubs, diamonds, spades
      suitOrder = ['hearts', 'clubs', 'diamonds', 'spades'];
    }

    return [...cards].sort((a, b) => {
      const suitDiff = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
      if (suitDiff !== 0) return suitDiff;
      return rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank);
    });
  }, [cards]);

  // Show Continue button after a short delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowButton(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const handleContinue = () => {
    if (hasConfirmed) return;
    setHasConfirmed(true);
    onComplete();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
    >
      <GoldParticles />
      <Confetti />

      <motion.div
        initial={{ scale: 0, rotate: -10 }}
        animate={{
          scale: [0, 1.2, 1],
          rotate: [-10, 5, 0],
        }}
        transition={{
          duration: 0.6,
          times: [0, 0.7, 1],
          type: 'spring',
          stiffness: 200,
        }}
        className="relative z-10 max-w-md sm:max-w-lg"
      >
        <ElectricBorder active color="#fbbf24" speed={1}>
          <div className="bg-gradient-to-b from-amber-900/90 to-amber-950/95 px-8 sm:px-16 py-8 sm:py-12 rounded-2xl text-center">
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
              }}
              className="text-4xl sm:text-6xl font-bold text-gold-400 mb-4"
              style={{
                textShadow: '0 0 30px #fbbf24, 0 0 60px #fbbf24',
              }}
            >
              WYKŁADANA!
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-xl sm:text-2xl text-white font-medium mb-4"
              title={playerName}
            >
              {truncateName(playerName)}
            </motion.p>

            {/* Cards display */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex flex-wrap justify-center gap-1 sm:gap-2 mb-4"
            >
              {sortedCards.map((card, index) => (
                <div
                  key={`${card.suit}-${card.rank}`}
                  style={{ perspective: '600px' }}
                >
                  <motion.div
                    initial={{ rotateY: 180, opacity: 0, scale: 0.8 }}
                    animate={{ rotateY: 0, opacity: 1, scale: 1 }}
                    transition={{
                      rotateY: { delay: 0.5 + index * 0.12, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] },
                      opacity: { delay: 0.5 + index * 0.12, duration: 0.15 },
                      scale: { delay: 0.5 + index * 0.12, duration: 0.3 },
                    }}
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    <Card card={card} size="sm" isPlayable={false} />
                  </motion.div>
                </div>
              ))}
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + sortedCards.length * 0.08 }}
              className="text-gold-300"
            >
              120 trick points{marriagePoints > 0 ? ` + ${marriagePoints} marriage points` : ''}
            </motion.p>

            {/* Continue button */}
            <AnimatePresence>
              {showButton && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  onClick={handleContinue}
                  disabled={hasConfirmed}
                  className="mt-6 px-8 py-3 bg-gold-500 hover:bg-gold-400 disabled:bg-gold-500/50 text-black font-bold rounded-lg transition-colors shadow-lg disabled:cursor-not-allowed"
                >
                  {hasConfirmed ? 'Waiting for others...' : 'Continue'}
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </ElectricBorder>
      </motion.div>
    </motion.div>
  );
}

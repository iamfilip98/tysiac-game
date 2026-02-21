'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { truncateName } from '@tysiac/shared';
import { usePreferencesStore } from '@tysiac/game-logic';
import { useIsMobile } from '@/hooks/useIsMobile';
import { Card } from './Card';
import type { Card as CardType } from '@tysiac/shared';

interface WykladanaModalProps {
  playerName: string;
  bid: number;
  marriagePoints?: number;
  cards: CardType[];
  onComplete: () => void;
}

// Confetti particle component
function Confetti({ count = 50 }: { count?: number }) {
  const colors = ['#fbbf24', '#f59e0b', '#fcd34d', '#d97706', '#fef3c7', '#fff'];
  const particles = Array.from({ length: count }, (_, i) => ({
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
  const animationsEnabled = usePreferencesStore((s) => s.animationsEnabled);
  const isMobile = useIsMobile();

  // Sort cards by suit and rank, ensuring red/black alternation when possible
  const sortedCards = useMemo(() => {
    const rankOrder = ['A', '10', 'K', 'Q', 'J', '9'];
    const isRedSuit = (suit: string) => suit === 'hearts' || suit === 'diamonds';
    const suitValue: Record<string, number> = { hearts: 100, diamonds: 80, clubs: 60, spades: 40 };

    const suitsInHand = Array.from(new Set(cards.map(c => c.suit)));

    let suitOrder: string[];
    if (suitsInHand.length === 3) {
      const redSuits = suitsInHand.filter(isRedSuit).sort((a, b) => suitValue[b] - suitValue[a]);
      const blackSuits = suitsInHand.filter(s => !isRedSuit(s)).sort((a, b) => suitValue[b] - suitValue[a]);

      if (redSuits.length === 2) {
        suitOrder = [redSuits[0], blackSuits[0], redSuits[1]];
      } else if (blackSuits.length === 2) {
        suitOrder = [blackSuits[0], redSuits[0], blackSuits[1]];
      } else {
        suitOrder = ['hearts', 'clubs', 'diamonds', 'spades'];
      }
    } else {
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      {animationsEnabled && <Confetti count={isMobile ? 25 : 50} />}

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative z-10 w-full max-w-md sm:max-w-lg bg-gradient-to-b from-table-800 to-table-900 border border-table-600 rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Decorative gold glow at top */}
        <div className="absolute inset-0 bg-gradient-to-b from-gold-500/10 via-transparent to-transparent pointer-events-none" />

        <div className="relative px-6 sm:px-10 py-6 sm:py-8 text-center">
          {/* Title */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', damping: 12, delay: 0.1 }}
            className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gold-300 via-gold-400 to-amber-500 mb-4"
            style={{
              textShadow: '0 0 15px rgba(251, 191, 36, 0.4)',
            }}
          >
            WYKŁADANA!
          </motion.div>

          {/* Player name */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-xl sm:text-2xl text-white font-medium mb-5"
            title={playerName}
          >
            {truncateName(playerName)}
          </motion.p>

          {/* Cards display */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-wrap justify-center gap-1 sm:gap-2 mb-5"
          >
            {sortedCards.map((card, index) => (
              <motion.div
                key={`${card.suit}-${card.rank}`}
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.08 }}
              >
                <Card card={card} size="md" isPlayable={false} />
              </motion.div>
            ))}
          </motion.div>

          {/* Points summary */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 + sortedCards.length * 0.08 }}
            className="text-gold-300 mb-6"
          >
            120 trick points{marriagePoints > 0 ? ` + ${marriagePoints} marriage points` : ''}
          </motion.p>

          {/* Continue button — always rendered, fades in to prevent layout shift */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: showButton ? 1 : 0 }}
            transition={{ duration: 0.3 }}
            onClick={handleContinue}
            disabled={hasConfirmed || !showButton}
            className="px-8 py-3 bg-gold-500 hover:bg-gold-400 disabled:bg-gold-500/50 text-black font-bold rounded-lg transition-colors shadow-lg disabled:cursor-not-allowed"
          >
            {hasConfirmed ? 'Waiting for others...' : 'Continue'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ElectricBorder } from '@/components/ui/ElectricBorder';
import { Card } from './Card';
import type { Card as CardType } from '@tysiac/shared';

const MAX_NAME_LENGTH = 7;

function truncateName(name: string): string {
  if (name.length <= MAX_NAME_LENGTH) return name;
  return name.slice(0, MAX_NAME_LENGTH) + '…';
}

interface WykladanaModalProps {
  playerName: string;
  bid: number;
  marriagePoints?: number;
  cards: CardType[];
  onComplete: () => void;
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
              {cards.map((card, index) => (
                <motion.div
                  key={`${card.suit}-${card.rank}`}
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 0.5 + index * 0.08 }}
                >
                  <Card card={card} size="sm" isPlayable={false} />
                </motion.div>
              ))}
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + cards.length * 0.08 }}
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

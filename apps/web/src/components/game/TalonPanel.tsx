'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Card } from './Card';
import type { Card as CardType } from '@tysiac/shared';

interface TalonDisplayProps {
  talon: CardType[];
  isRevealed: boolean;
}

export function TalonDisplay({ talon, isRevealed }: TalonDisplayProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      <AnimatePresence mode="wait">
        {isRevealed ? (
          // Revealed talon cards - simple fade/scale animation (no 3D transforms)
          talon.map((card, i) => (
            <motion.div
              key={`${card.suit}-${card.rank}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                delay: i * 0.1,
                duration: 0.25,
                ease: 'easeOut'
              }}
              style={{ willChange: 'opacity, transform' }}
            >
              <Card card={card} size="md" isPlayable={false} />
            </motion.div>
          ))
        ) : (
          // Face down talon
          Array.from({ length: 3 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{
                delay: i * 0.08,
                duration: 0.2,
                ease: 'easeOut'
              }}
              className="w-16 h-24 rounded-lg card-back"
              style={{ willChange: 'opacity, transform' }}
            />
          ))
        )}
      </AnimatePresence>
    </div>
  );
}

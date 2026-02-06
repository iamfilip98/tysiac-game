'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DealAnimationProps {
  playerCount: 3 | 4;
  onComplete: () => void;
}

export function DealAnimation({ playerCount, onComplete }: DealAnimationProps) {
  const [phase, setPhase] = useState<'shuffle' | 'deal' | 'done'>('shuffle');
  const [dealtCards, setDealtCards] = useState<number[]>([]);

  const totalCards = playerCount === 4 ? 24 : 24;
  const cardsPerPlayer = playerCount === 4 ? 6 : 7;
  const talonCards = playerCount === 4 ? 0 : 3;

  // Player positions (angles around center)
  const playerPositions = playerCount === 3
    ? [
        { x: 0, y: 120, label: 'You' },      // bottom
        { x: -160, y: -40, label: 'Left' },   // top-left
        { x: 160, y: -40, label: 'Right' },   // top-right
      ]
    : [
        { x: 0, y: 120, label: 'You' },
        { x: -160, y: 0, label: 'Left' },
        { x: 0, y: -100, label: 'Top' },
        { x: 160, y: 0, label: 'Right' },
      ];

  useEffect(() => {
    // Shuffle phase
    const shuffleTimer = setTimeout(() => {
      setPhase('deal');
    }, 800);

    return () => clearTimeout(shuffleTimer);
  }, []);

  useEffect(() => {
    if (phase !== 'deal') return;

    // Deal cards one by one
    const totalToDeal = cardsPerPlayer * playerCount + talonCards;
    let cardIndex = 0;

    const dealInterval = setInterval(() => {
      if (cardIndex >= totalToDeal) {
        clearInterval(dealInterval);
        setTimeout(() => {
          setPhase('done');
          onComplete();
        }, 400);
        return;
      }
      setDealtCards(prev => [...prev, cardIndex]);
      cardIndex++;
    }, 60);

    return () => clearInterval(dealInterval);
  }, [phase, cardsPerPlayer, playerCount, talonCards, onComplete]);

  return (
    <AnimatePresence>
      {phase !== 'done' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
        >
          {/* Deck in center */}
          <div className="relative">
            {/* Deck stack */}
            {phase === 'shuffle' && (
              <motion.div
                animate={{
                  rotateZ: [0, -5, 5, -3, 3, 0],
                  y: [0, -4, 0, -2, 0],
                }}
                transition={{ duration: 0.6, ease: 'easeInOut' }}
                className="relative"
              >
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="absolute w-14 h-20 rounded-lg card-back"
                    style={{
                      top: -i * 2,
                      left: -i * 1,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    }}
                  />
                ))}
                <div className="w-14 h-20" /> {/* Spacer */}
              </motion.div>
            )}

            {/* Flying cards */}
            {dealtCards.map((cardIdx) => {
              const playerIdx = cardIdx < cardsPerPlayer * playerCount
                ? cardIdx % playerCount
                : -1; // talon
              const target = playerIdx >= 0
                ? playerPositions[playerIdx]
                : { x: 0, y: -80 }; // talon goes above center

              return (
                <motion.div
                  key={cardIdx}
                  initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                  animate={{
                    x: target.x,
                    y: target.y,
                    opacity: 0,
                    scale: 0.6,
                  }}
                  transition={{
                    duration: 0.3,
                    ease: [0.25, 0.1, 0.25, 1],
                  }}
                  className="absolute top-0 left-0 w-14 h-20 rounded-lg card-back"
                  style={{
                    boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                    zIndex: cardIdx,
                  }}
                />
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

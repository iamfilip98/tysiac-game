'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ElectricBorder } from '@/components/ui/ElectricBorder';

interface WykladanaModalProps {
  playerName: string;
  bid: number;
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

export function WykladanaModal({ playerName, bid, onComplete }: WykladanaModalProps) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
      setTimeout(onComplete, 500); // Wait for exit animation
    }, 3000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
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
            className="relative z-10"
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
                  WYKLADANA!
                </motion.div>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-xl sm:text-2xl text-white font-medium mb-2"
                >
                  {playerName}
                </motion.p>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-base sm:text-lg text-white/70"
                >
                  Wins ALL 8 tricks with perfect cards!
                </motion.p>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="text-gold-300 mt-4"
                >
                  Bid: {bid} + 120 trick points
                </motion.p>
              </div>
            </ElectricBorder>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

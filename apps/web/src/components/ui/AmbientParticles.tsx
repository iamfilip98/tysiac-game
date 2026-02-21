'use client';

import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { usePreferencesStore } from '@tysiac/game-logic';

interface AmbientParticlesProps {
  count?: number;
  color?: string;
  className?: string;
}

export function AmbientParticles({
  count = 12,
  color = 'rgba(251,191,36,0.12)',
  className,
}: AmbientParticlesProps) {
  const animationsEnabled = usePreferencesStore((s) => s.animationsEnabled);

  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        duration: 6 + Math.random() * 4,
        delay: Math.random() * 6,
      })),
    [count]
  );

  if (!animationsEnabled) return null;

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ''}`}
      aria-hidden="true"
    >
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute w-1 h-1 rounded-full"
          style={{ left: p.left, top: p.top, backgroundColor: color }}
          animate={{ y: [0, -40, 0], opacity: [0, 0.5, 0] }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

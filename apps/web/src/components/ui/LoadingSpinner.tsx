'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <motion.div
      className={cn('relative', sizes[size], className)}
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
    >
      <div className="absolute inset-0 border-2 border-gold-500/30 rounded-full" />
      <div className="absolute inset-0 border-2 border-transparent border-t-gold-500 rounded-full" />
    </motion.div>
  );
}

// Card dealing animation
export function CardDealingAnimation() {
  return (
    <div className="flex items-center justify-center gap-2">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-12 h-16 rounded-md card-back"
          initial={{ y: -100, opacity: 0, rotate: -30 }}
          animate={{
            y: 0,
            opacity: 1,
            rotate: 0,
          }}
          transition={{
            delay: i * 0.15,
            type: 'spring',
            stiffness: 200,
            damping: 15,
          }}
        />
      ))}
    </div>
  );
}

// Thinking dots animation
export function ThinkingDots({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 bg-white/60 rounded-full"
          animate={{
            y: [0, -6, 0],
            opacity: [0.4, 1, 0.4],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.15,
          }}
        />
      ))}
    </div>
  );
}

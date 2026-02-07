'use client';

import { ReactNode, CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ElectricBorderProps {
  children: ReactNode;
  className?: string;
  color?: string;
  glowColor?: string;
  speed?: number;
  active?: boolean;
}

export function ElectricBorder({
  children,
  className,
  color = '#fbbf24',
  glowColor,
  speed = 2,
  active = true,
}: ElectricBorderProps) {
  const glow = glowColor || `${color}80`;

  const style = {
    '--border-color': color,
    '--glow-color': glow,
    '--animation-speed': `${speed}s`,
  } as CSSProperties;

  return (
    <div
      className={cn(
        'relative rounded-xl',
        active && 'electric-border-wrapper',
        className
      )}
      style={style}
    >
      {/* Animated border + glow */}
      {active && (
        <motion.div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            border: `2px solid ${color}`,
            boxShadow: `0 0 15px ${glow}, inset 0 0 15px ${glow}`,
          }}
          animate={{
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: speed,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

// Simpler version for card borders
export function CardGlow({
  children,
  active = false,
  color = '#fbbf24',
}: {
  children: ReactNode;
  active?: boolean;
  color?: string;
}) {
  return (
    <motion.div
      className="relative"
      animate={
        active
          ? {
              boxShadow: [
                `0 0 10px ${color}40`,
                `0 0 25px ${color}60`,
                `0 0 10px ${color}40`,
              ],
            }
          : {}
      }
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      {children}
    </motion.div>
  );
}

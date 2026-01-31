'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getSuitSymbol, getSuitColor, getCardDescription } from '@/lib/utils';
import type { Card as CardType } from '@tysiac/shared';

// Hook to detect mobile for performance optimizations
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

interface CardProps {
  card: CardType;
  isSelected?: boolean;
  isPlayable?: boolean;
  isFaceDown?: boolean;
  isMarriageCard?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
  delay?: number;
}

const sizeClasses = {
  sm: 'w-12 h-[72px] text-xs',
  md: 'w-16 h-[96px] text-sm',
  lg: 'w-20 h-[120px] text-base',
};

export function Card({
  card,
  isSelected = false,
  isPlayable = true,
  isFaceDown = false,
  isMarriageCard = false,
  size = 'md',
  onClick,
  style,
  className,
  delay = 0,
}: CardProps) {
  const isMobile = useIsMobile();
  const suitSymbol = getSuitSymbol(card.suit);
  const color = getSuitColor(card.suit);
  const cardDescription = getCardDescription(card);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && isPlayable && onClick) {
      e.preventDefault();
      onClick();
    }
  };

  // Simpler transitions for mobile
  const transition = isMobile
    ? { delay, duration: 0.2, ease: 'easeOut' }
    : { delay, type: 'spring', stiffness: 300, damping: 25 };

  if (isFaceDown) {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: -50 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={transition}
        className={cn(
          'playing-card card-back will-change-transform',
          sizeClasses[size],
          className
        )}
        style={{ ...style, transform: 'translateZ(0)' }}
        role="img"
        aria-label="Face-down card"
      />
    );
  }

  const isInteractive = isPlayable && onClick;

  return (
    <div className="relative">
      {/* Solid gold border for marriage cards */}
      {isMarriageCard && (
        <div
          className="absolute -inset-[3px] rounded-xl bg-gradient-to-br from-yellow-400 via-gold-400 to-yellow-500"
          style={{
            boxShadow: '0 0 12px 2px rgba(251, 191, 36, 0.6), inset 0 0 4px rgba(255, 255, 255, 0.3)',
          }}
          aria-hidden="true"
        />
      )}
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: -50 }}
        animate={{
          scale: 1,
          opacity: 1,
          y: isSelected ? -16 : 0,
        }}
        whileHover={isPlayable && !isMobile ? { y: -8, scale: 1.02 } : undefined}
        whileTap={isPlayable ? { scale: 0.98 } : undefined}
        transition={transition}
        onClick={isInteractive ? onClick : undefined}
        onKeyDown={isInteractive ? handleKeyDown : undefined}
        role={isInteractive ? 'button' : 'img'}
        tabIndex={isInteractive ? 0 : -1}
        aria-label={`${cardDescription}${isSelected ? ', selected' : ''}${isPlayable ? '' : ', not playable'}${isMarriageCard ? ', marriage available' : ''}`}
        aria-pressed={isInteractive ? isSelected : undefined}
        className={cn(
          'playing-card will-change-transform relative',
          color === 'red' ? 'red' : 'black',
          sizeClasses[size],
          isPlayable && 'cursor-pointer ring-2 ring-green-500',
          !isPlayable && 'opacity-50 cursor-not-allowed',
          isSelected && 'ring-2 ring-gold-400 shadow-glow',
          isInteractive && 'focus:outline-none focus:ring-2 focus:ring-gold-500 focus:ring-offset-2 focus:ring-offset-table-900',
          className
        )}
        style={{ ...style, transform: 'translateZ(0)' }}
      >
        {/* Card content */}
        <div className="absolute inset-1 flex flex-col items-center justify-center" aria-hidden="true">
          {/* Center rank and suit */}
          <span className={cn('font-bold text-lg', color === 'red' ? 'text-red-600' : 'text-gray-900')}>
            {card.rank}
          </span>
          <span className={cn('text-3xl', color === 'red' ? 'text-red-600' : 'text-gray-900')}>
            {suitSymbol}
          </span>
        </div>
      </motion.div>
    </div>
  );
}

// Card placeholder (empty spot)
export function CardPlaceholder({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-lg border-2 border-dashed border-white/20',
        'bg-white/5',
        sizeClasses[size],
        className
      )}
      role="presentation"
      aria-hidden="true"
    />
  );
}

// Mini card for score display
export function MiniCard({ card, className }: { card: CardType; className?: string }) {
  const suitSymbol = getSuitSymbol(card.suit);
  const color = getSuitColor(card.suit);
  const description = getCardDescription(card);

  return (
    <span
      className={cn('inline-flex items-center gap-0.5 font-mono text-sm', color === 'red' ? 'text-red-400' : 'text-white', className)}
      role="img"
      aria-label={description}
    >
      <span aria-hidden="true">{card.rank}{suitSymbol}</span>
    </span>
  );
}

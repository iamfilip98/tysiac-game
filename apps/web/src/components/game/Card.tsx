'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getSuitSymbol, getSuitColor, getCardDescription } from '@/lib/utils';
import type { Card as CardType } from '@tysiac/shared';

interface CardProps {
  card: CardType;
  isSelected?: boolean;
  isPlayable?: boolean;
  isFaceDown?: boolean;
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
  size = 'md',
  onClick,
  style,
  className,
  delay = 0,
}: CardProps) {
  const suitSymbol = getSuitSymbol(card.suit);
  const color = getSuitColor(card.suit);
  const cardDescription = getCardDescription(card);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && isPlayable && onClick) {
      e.preventDefault();
      onClick();
    }
  };

  if (isFaceDown) {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: -50 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ delay, type: 'spring', stiffness: 300, damping: 25 }}
        className={cn(
          'playing-card card-back',
          sizeClasses[size],
          className
        )}
        style={style}
        role="img"
        aria-label="Face-down card"
      />
    );
  }

  const isInteractive = isPlayable && onClick;

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0, y: -50 }}
      animate={{
        scale: 1,
        opacity: 1,
        y: isSelected ? -16 : 0,
      }}
      whileHover={isPlayable ? { y: -8, scale: 1.02 } : undefined}
      whileTap={isPlayable ? { scale: 0.98 } : undefined}
      transition={{
        delay,
        type: 'spring',
        stiffness: 300,
        damping: 25,
      }}
      onClick={isInteractive ? onClick : undefined}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
      role={isInteractive ? 'button' : 'img'}
      tabIndex={isInteractive ? 0 : -1}
      aria-label={`${cardDescription}${isSelected ? ', selected' : ''}${isPlayable ? '' : ', not playable'}`}
      aria-pressed={isInteractive ? isSelected : undefined}
      className={cn(
        'playing-card',
        color === 'red' ? 'red' : 'black',
        sizeClasses[size],
        isPlayable && 'cursor-pointer',
        !isPlayable && 'opacity-50 cursor-not-allowed',
        isSelected && 'ring-2 ring-gold-400 shadow-glow',
        isInteractive && 'focus:outline-none focus:ring-2 focus:ring-gold-500 focus:ring-offset-2 focus:ring-offset-table-900',
        className
      )}
      style={style}
    >
      {/* Card content */}
      <div className="absolute inset-1 flex flex-col justify-between p-1" aria-hidden="true">
        {/* Top left */}
        <div className={cn('flex flex-col items-center leading-none', color === 'red' ? 'text-red-600' : 'text-gray-900')}>
          <span className="font-bold">{card.rank}</span>
          <span>{suitSymbol}</span>
        </div>

        {/* Center suit */}
        <div className={cn('absolute inset-0 flex items-center justify-center text-3xl', color === 'red' ? 'text-red-600' : 'text-gray-900')}>
          {suitSymbol}
        </div>

        {/* Bottom right (rotated) */}
        <div className={cn('flex flex-col items-center leading-none self-end rotate-180', color === 'red' ? 'text-red-600' : 'text-gray-900')}>
          <span className="font-bold">{card.rank}</span>
          <span>{suitSymbol}</span>
        </div>
      </div>
    </motion.div>
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

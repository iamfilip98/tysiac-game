'use client';

import { motion } from 'framer-motion';
import { cn, getSuitSymbol, getSuitColor, getCardDescription } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useIsMobile';
import { usePreferencesStore } from '@/stores/preferencesStore';
import type { Card as CardType } from '@tysiac/shared';

interface CardProps {
  card: CardType;
  isSelected?: boolean;
  isPlayable?: boolean;
  isFaceDown?: boolean;
  isMarriageCard?: boolean;
  isTrumpCard?: boolean;
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
  isTrumpCard = false,
  size = 'md',
  onClick,
  style,
  className,
  delay = 0,
}: CardProps) {
  const isMobile = useIsMobile();
  const animationsEnabled = usePreferencesStore((s) => s.animationsEnabled);
  const suitSymbol = getSuitSymbol(card.suit);
  const color = getSuitColor(card.suit);
  const cardDescription = getCardDescription(card);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && isPlayable && onClick) {
      e.preventDefault();
      onClick();
    }
  };

  // Simpler, smoother transitions - avoid springs on mobile for better performance
  const transition = isMobile
    ? { delay, duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }
    : { delay, duration: 0.3, ease: [0.25, 0.1, 0.25, 1] };

  if (isFaceDown) {
    return (
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={transition}
        className={cn(
          'playing-card card-back',
          sizeClasses[size],
          className
        )}
        style={{ ...style, willChange: 'opacity, transform' }}
        role="img"
        aria-label="Face-down card"
      />
    );
  }

  const isInteractive = isPlayable && onClick;

  return (
    <div className="relative">
      {/* Outer glow for marriage cards */}
      {isMarriageCard && (
        <div
          className="absolute -inset-[4px] rounded-xl"
          style={{
            boxShadow: '0 0 20px 4px rgba(212, 175, 55, 0.7), 0 0 40px 8px rgba(245, 231, 163, 0.3)',
            border: '1px solid rgba(245, 231, 163, 0.5)',
          }}
          aria-hidden="true"
        />
      )}
      {/* Outer glow for trump cards (marriage gold takes priority) */}
      {isTrumpCard && !isMarriageCard && (
        <div
          className="absolute -inset-[4px] rounded-xl"
          style={{
            boxShadow: '0 0 20px 4px rgba(96,165,250,0.7), 0 0 40px 8px rgba(147,197,253,0.3)',
            border: '1px solid rgba(147,197,253,0.5)',
          }}
          aria-hidden="true"
        />
      )}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{
          scale: 1,
          opacity: 1,
          y: isSelected ? -16 : 0,
        }}
        whileHover={isPlayable && !isMobile && animationsEnabled ? { y: -8 } : undefined}
        whileTap={isPlayable && !isMobile && animationsEnabled ? { scale: 0.97 } : undefined}
        transition={transition}
        onClick={isInteractive ? onClick : undefined}
        onKeyDown={isInteractive ? handleKeyDown : undefined}
        role={isInteractive ? 'button' : 'img'}
        tabIndex={isInteractive ? 0 : -1}
        aria-label={`${cardDescription}${isSelected ? ', selected' : ''}${isPlayable ? '' : ', not playable'}${isMarriageCard ? ', marriage available' : ''}`}
        aria-pressed={isInteractive ? isSelected : undefined}
        className={cn(
          'playing-card relative overflow-hidden',
          color === 'red' ? 'red' : 'black',
          sizeClasses[size],
          isPlayable && 'cursor-pointer ring-2 ring-green-500',
          !isPlayable && 'opacity-50 cursor-not-allowed',
          isSelected && 'ring-2 ring-gold-400 shadow-glow',
          isInteractive && 'focus:outline-none focus:ring-2 focus:ring-gold-500 focus:ring-offset-2 focus:ring-offset-table-900',
          isMobile && isPlayable && 'active:scale-[0.97]',
          className
        )}
        style={{ ...style, willChange: 'opacity, transform' }}
      >
        {/* Premium gold effect for marriage cards */}
        {isMarriageCard && (
          <>
            {/* Base metallic gold gradient */}
            <div
              className="absolute inset-0 rounded-lg"
              style={{
                background: `linear-gradient(
                  135deg,
                  #d4af37 0%,
                  #f5e7a3 15%,
                  #d4af37 30%,
                  #b8941f 45%,
                  #d4af37 60%,
                  #f5e7a3 75%,
                  #d4af37 100%
                )`,
                opacity: 0.92,
              }}
              aria-hidden="true"
            />
            {/* Animated shimmer overlay - disabled on mobile / animations off */}
            {!isMobile && animationsEnabled && (
              <div
                className="absolute inset-0 rounded-lg overflow-hidden"
                aria-hidden="true"
              >
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(
                      110deg,
                      transparent 20%,
                      rgba(255, 255, 255, 0.4) 40%,
                      rgba(255, 255, 255, 0.6) 50%,
                      rgba(255, 255, 255, 0.4) 60%,
                      transparent 80%
                    )`,
                    backgroundSize: '200% 100%',
                    animation: 'goldShimmer 2.5s ease-in-out infinite',
                  }}
                />
              </div>
            )}
            {/* Sparkle particles - disabled on mobile / animations off */}
            {!isMobile && animationsEnabled && (
              <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none" aria-hidden="true">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-1 h-1 rounded-full bg-white"
                    style={{
                      top: `${15 + (i * 15)}%`,
                      left: `${10 + (i * 16) % 80}%`,
                      boxShadow: '0 0 4px 1px rgba(255, 255, 255, 0.8)',
                      animation: `sparkle ${1.5 + i * 0.3}s ease-in-out infinite`,
                      animationDelay: `${i * 0.2}s`,
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
        {/* Blue effect for trump cards (marriage gold takes priority) */}
        {isTrumpCard && !isMarriageCard && (
          <>
            {/* Subtle blue gradient overlay */}
            <div
              className="absolute inset-0 rounded-lg"
              style={{
                background: `linear-gradient(
                  135deg,
                  rgba(96,165,250,0.15) 0%,
                  rgba(147,197,253,0.25) 30%,
                  rgba(96,165,250,0.15) 60%,
                  rgba(59,130,246,0.2) 100%
                )`,
              }}
              aria-hidden="true"
            />
            {/* Animated blue shimmer - desktop only, animations on */}
            {!isMobile && animationsEnabled && (
              <div
                className="absolute inset-0 rounded-lg overflow-hidden"
                aria-hidden="true"
              >
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(
                      110deg,
                      transparent 20%,
                      rgba(147,197,253,0.3) 40%,
                      rgba(191,219,254,0.5) 50%,
                      rgba(147,197,253,0.3) 60%,
                      transparent 80%
                    )`,
                    backgroundSize: '200% 100%',
                    animation: 'blueShimmer 2.5s ease-in-out infinite',
                  }}
                />
              </div>
            )}
            {/* Blue sparkle particles - desktop only, animations on */}
            {!isMobile && animationsEnabled && (
              <div className="absolute inset-0 rounded-lg overflow-hidden pointer-events-none" aria-hidden="true">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-1 h-1 rounded-full bg-white"
                    style={{
                      top: `${20 + (i * 20)}%`,
                      left: `${15 + (i * 22) % 70}%`,
                      boxShadow: '0 0 4px 1px rgba(147,197,253,0.8)',
                      animation: `sparkle ${1.5 + i * 0.3}s ease-in-out infinite`,
                      animationDelay: `${i * 0.25}s`,
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
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

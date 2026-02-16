'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { cn, getCardDescription } from '@/lib/utils';
import { getSuitSymbol, getSuitColor } from '@tysiac/shared';
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
  size?: 'xs' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
  delay?: number;
}

const sizeClasses = {
  xs: 'w-12 h-[72px] text-xs',
  sm: 'w-14 h-[84px] text-xs',
  md: 'w-16 h-[96px] text-sm',
  lg: 'w-20 h-[120px] text-base',
};

// Face card SVG portraits
function KingPortrait({ color }: { color: string }) {
  const fill = color === 'red' ? 'var(--card-red)' : 'var(--card-black)';
  return (
    <svg viewBox="0 0 40 56" className="w-full h-full" aria-hidden="true">
      {/* Crown */}
      <polygon points="10,16 13,8 16,14 20,4 24,14 27,8 30,16" fill={fill} opacity="0.9" />
      <rect x="10" y="15" width="20" height="3" rx="0.5" fill={fill} opacity="0.8" />
      {/* Head */}
      <ellipse cx="20" cy="24" rx="6" ry="5.5" fill={fill} opacity="0.7" />
      {/* Body/shoulders */}
      <path d="M11,36 Q11,30 15,29 L20,28 L25,29 Q29,30 29,36 Z" fill={fill} opacity="0.6" />
      {/* Sword (right side) */}
      <line x1="29" y1="20" x2="33" y2="36" stroke={fill} strokeWidth="1.5" opacity="0.5" />
      <line x1="28" y1="24" x2="34" y2="24" stroke={fill} strokeWidth="1.2" opacity="0.5" />
      {/* Robe detail */}
      <path d="M15,32 L20,36 L25,32" fill="none" stroke={fill} strokeWidth="0.8" opacity="0.4" />
      {/* Rank letter */}
      <text x="20" y="50" textAnchor="middle" fontSize="12" fontWeight="bold" fontFamily="serif" fill={fill} opacity="0.85">K</text>
    </svg>
  );
}

function QueenPortrait({ color }: { color: string }) {
  const fill = color === 'red' ? 'var(--card-red)' : 'var(--card-black)';
  return (
    <svg viewBox="0 0 40 56" className="w-full h-full" aria-hidden="true">
      {/* Tiara/crown */}
      <path d="M13,16 L15,10 L17,14 L20,7 L23,14 L25,10 L27,16" fill="none" stroke={fill} strokeWidth="1.2" opacity="0.9" />
      <ellipse cx="20" cy="8" rx="1.5" ry="1.5" fill={fill} opacity="0.7" />
      <rect x="13" y="15" width="14" height="2" rx="0.5" fill={fill} opacity="0.7" />
      {/* Head */}
      <ellipse cx="20" cy="23" rx="5.5" ry="5" fill={fill} opacity="0.7" />
      {/* Neck */}
      <rect x="18" y="27" width="4" height="3" rx="1" fill={fill} opacity="0.5" />
      {/* Body/dress */}
      <path d="M12,40 Q12,31 16,30 L20,29 L24,30 Q28,31 28,40 Z" fill={fill} opacity="0.5" />
      {/* Dress flowing detail */}
      <path d="M14,34 Q20,38 26,34" fill="none" stroke={fill} strokeWidth="0.8" opacity="0.35" />
      <path d="M13,37 Q20,41 27,37" fill="none" stroke={fill} strokeWidth="0.8" opacity="0.3" />
      {/* Rank letter */}
      <text x="20" y="50" textAnchor="middle" fontSize="12" fontWeight="bold" fontFamily="serif" fill={fill} opacity="0.85">Q</text>
    </svg>
  );
}

function JackPortrait({ color }: { color: string }) {
  const fill = color === 'red' ? 'var(--card-red)' : 'var(--card-black)';
  return (
    <svg viewBox="0 0 40 56" className="w-full h-full" aria-hidden="true">
      {/* Helmet */}
      <path d="M14,18 Q14,8 20,6 Q26,8 26,18 Z" fill={fill} opacity="0.8" />
      {/* Visor slit */}
      <path d="M16,14 L24,14" stroke="#fff" strokeWidth="1.2" opacity="0.4" />
      {/* Helmet plume */}
      <path d="M20,6 Q22,2 24,4 Q23,6 20,6" fill={fill} opacity="0.6" />
      {/* Head/face area */}
      <rect x="15" y="17" width="10" height="5" rx="1" fill={fill} opacity="0.5" />
      {/* Shoulders */}
      <path d="M12,30 Q12,24 16,23 L20,22 L24,23 Q28,24 28,30 Z" fill={fill} opacity="0.55" />
      {/* Shield */}
      <path d="M14,28 L14,37 Q14,41 20,43 Q26,41 26,37 L26,28 Z" fill={fill} opacity="0.35" />
      {/* Shield cross */}
      <line x1="20" y1="28" x2="20" y2="41" stroke={fill} strokeWidth="1" opacity="0.25" />
      <line x1="14" y1="34" x2="26" y2="34" stroke={fill} strokeWidth="1" opacity="0.25" />
      {/* Shoulder guards */}
      <ellipse cx="13" cy="26" rx="3" ry="2" fill={fill} opacity="0.3" />
      <ellipse cx="27" cy="26" rx="3" ry="2" fill={fill} opacity="0.3" />
      {/* Rank letter */}
      <text x="20" y="52" textAnchor="middle" fontSize="12" fontWeight="bold" fontFamily="serif" fill={fill} opacity="0.85">J</text>
    </svg>
  );
}

// Static transition objects — avoids re-creating on every render
const TRANSITION_MOBILE = { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] as const };
const TRANSITION_DESKTOP = { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as const };

export const Card = memo(function Card({
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
  const theme = usePreferencesStore((s) => s.theme);
  const cardStyle = usePreferencesStore((s) => s.cardStyle);
  const suitSymbol = getSuitSymbol(card.suit);
  const color = getSuitColor(card.suit);
  const cardDescription = getCardDescription(card);
  const isFaceCard = ['K', 'Q', 'J'].includes(card.rank);
  const isHighCard = ['A', 'K', 'Q', 'J'].includes(card.rank);
  const showCornerPips = true; // Show on all sizes
  const showPortrait = isFaceCard && size !== 'xs';
  const isDarkCards = cardStyle === 'black' || (cardStyle === 'auto' && theme === 'dark');

  // Silver palette for dark/black card mode, gold for light
  const marriageColors = isDarkCards
    ? {
        primary: '#b8bcc8',
        highlight: '#e4e7ed',
        dark: '#838791',
        glowPrimary: 'rgba(184,188,200,0.7)',
        glowSecondary: 'rgba(228,231,237,0.3)',
        borderOuter: 'rgba(228,231,237,0.5)',
        borderInner: 'rgba(140,145,160,0.25)',
      }
    : {
        primary: '#d4af37',
        highlight: '#f5e7a3',
        dark: '#b8941f',
        glowPrimary: 'rgba(212,175,55,0.7)',
        glowSecondary: 'rgba(245,231,163,0.3)',
        borderOuter: 'rgba(245,231,163,0.5)',
        borderInner: 'rgba(120,90,20,0.25)',
      };

  const textColor = color === 'red' ? 'var(--card-red)' : 'var(--card-black)';

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && isPlayable && onClick) {
      e.preventDefault();
      onClick();
    }
  };

  const transition = delay > 0
    ? { delay, ...(isMobile ? TRANSITION_MOBILE : TRANSITION_DESKTOP) }
    : isMobile ? TRANSITION_MOBILE : TRANSITION_DESKTOP;

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
        style={style}
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
            boxShadow: `0 0 20px 4px ${marriageColors.glowPrimary}, 0 0 40px 8px ${marriageColors.glowSecondary}`,
            border: `1px solid ${marriageColors.borderOuter}`,
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
          isPlayable && 'cursor-pointer ring-2 ring-gold-400',
          !isPlayable && onClick && 'opacity-50 cursor-not-allowed',
          isSelected && 'ring-2 ring-gold-400 shadow-glow',
          isInteractive && 'focus:outline-none focus:ring-2 focus:ring-gold-500 focus:ring-offset-2 focus:ring-offset-table-900',
          isMobile && isPlayable && 'active:scale-[0.97]',
          className
        )}
        style={style}
      >
        {/* Paper texture overlay */}
        <div
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 30% 40%, rgba(0,0,0,0.02) 1px, transparent 1px),
              radial-gradient(circle at 70% 60%, rgba(0,0,0,0.015) 1px, transparent 1px),
              radial-gradient(circle at 50% 20%, rgba(0,0,0,0.02) 0.5px, transparent 0.5px)`,
            backgroundSize: '8px 8px, 12px 12px, 6px 6px',
          }}
          aria-hidden="true"
        />
        {/* Premium gold effect for marriage cards */}
        {isMarriageCard && (
          <>
            {/* Base metallic gold gradient */}
            <div
              className="absolute inset-0 rounded-lg"
              style={{
                background: `linear-gradient(
                  135deg,
                  ${marriageColors.primary} 0%,
                  ${marriageColors.highlight} 15%,
                  ${marriageColors.primary} 30%,
                  ${marriageColors.dark} 45%,
                  ${marriageColors.primary} 60%,
                  ${marriageColors.highlight} 75%,
                  ${marriageColors.primary} 100%
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
        {/* Decorative inner frame — all cards */}
        <div
          className="absolute inset-[5px] rounded border pointer-events-none"
          style={{
            borderColor: isMarriageCard
              ? marriageColors.borderInner
              : isHighCard
                ? 'rgba(128, 128, 128, 0.18)'
                : 'rgba(128, 128, 128, 0.1)',
          }}
          aria-hidden="true"
        />
        {/* Gold hairline for face cards */}
        {isHighCard && !isMarriageCard && (
          <div
            className="absolute inset-[4px] rounded pointer-events-none"
            style={{ border: '0.5px solid rgba(212, 175, 55, 0.12)' }}
            aria-hidden="true"
          />
        )}
        {/* Card content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center card-text" aria-hidden="true">
          {/* Top-left corner pip */}
          {showCornerPips && (
            <div
              className="absolute top-[2px] left-[3px] flex flex-col items-center leading-none"
              style={{ color: textColor }}
            >
              <span className={cn('font-bold', size === 'lg' ? 'text-[17px]' : size === 'md' ? 'text-[14px]' : size === 'sm' ? 'text-[12px]' : 'text-[10px]')}>{card.rank}</span>
              <span className={cn('-mt-[1px]', size === 'lg' ? 'text-[16px]' : size === 'md' ? 'text-[13px]' : size === 'sm' ? 'text-[11px]' : 'text-[9px]')}>{suitSymbol}</span>
            </div>
          )}
          {/* Center: SVG portrait for face cards (md/lg/sm), text for others */}
          {showPortrait ? (
            <div className="flex items-center justify-center w-[82%] h-[72%]">
              {card.rank === 'K' && <KingPortrait color={color} />}
              {card.rank === 'Q' && <QueenPortrait color={color} />}
              {card.rank === 'J' && <JackPortrait color={color} />}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center w-[82%] h-[72%]">
              <span
                className={cn('font-bold', size === 'xs' ? 'text-lg' : size === 'sm' ? 'text-xl' : size === 'md' ? 'text-3xl' : 'text-4xl')}
                style={{ color: textColor }}
              >
                {card.rank}
              </span>
              <span
                className={cn('-mt-1', size === 'xs' ? 'text-xl' : size === 'sm' ? 'text-2xl' : size === 'md' ? 'text-4xl' : 'text-5xl')}
                style={{ color: textColor }}
              >
                {suitSymbol}
              </span>
            </div>
          )}
          {/* Bottom-right corner pip (rotated 180deg) */}
          {showCornerPips && (
            <div
              className="absolute bottom-[2px] right-[3px] flex flex-col items-center leading-none rotate-180"
              style={{ color: textColor }}
            >
              <span className={cn('font-bold', size === 'lg' ? 'text-[17px]' : size === 'md' ? 'text-[14px]' : size === 'sm' ? 'text-[12px]' : 'text-[10px]')}>{card.rank}</span>
              <span className={cn('-mt-[1px]', size === 'lg' ? 'text-[16px]' : size === 'md' ? 'text-[13px]' : size === 'sm' ? 'text-[11px]' : 'text-[9px]')}>{suitSymbol}</span>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
});

// Card placeholder (empty spot)
export function CardPlaceholder({ size = 'md', className }: { size?: 'xs' | 'sm' | 'md' | 'lg'; className?: string }) {
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

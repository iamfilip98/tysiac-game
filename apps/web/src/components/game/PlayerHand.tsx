'use client';

import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from './Card';
import { cn } from '@/lib/utils';
import type { Card as CardType, ValidAction } from '@tysiac/shared';

interface PlayerHandProps {
  cards: CardType[];
  validActions: ValidAction[];
  selectedCard: CardType | null;
  onSelectCard: (card: CardType) => void;
  onPlayCard: (card: CardType) => void;
  isMyTurn: boolean;
}

// Hook to track screen size
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

// Simpler mobile transition
const mobileTransition = { duration: 0.15, ease: 'easeOut' };
const desktopTransition = { type: 'spring', stiffness: 300, damping: 25 };

export function PlayerHand({
  cards,
  validActions,
  selectedCard,
  onSelectCard,
  onPlayCard,
  isMyTurn,
}: PlayerHandProps) {
  const isMobile = useIsMobile();

  // Get playable cards from valid actions
  const playableCards = useMemo(() => {
    const playAction = validActions.find((a) => a.type === 'playCard');
    if (playAction && playAction.type === 'playCard') {
      return playAction.validCards;
    }
    return [];
  }, [validActions]);

  // Sort cards by suit and rank
  const sortedCards = useMemo(() => {
    const suitOrder = ['spades', 'hearts', 'diamonds', 'clubs'];
    const rankOrder = ['A', '10', 'K', 'Q', 'J', '9'];

    return [...cards].sort((a, b) => {
      const suitDiff = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
      if (suitDiff !== 0) return suitDiff;
      return rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank);
    });
  }, [cards]);

  const isCardPlayable = (card: CardType) => {
    return playableCards.some(
      (c) => c.suit === card.suit && c.rank === card.rank
    );
  };

  const isCardSelected = (card: CardType): boolean => {
    return !!(
      selectedCard &&
      selectedCard.suit === card.suit &&
      selectedCard.rank === card.rank
    );
  };

  const handleCardClick = (card: CardType) => {
    if (!isMyTurn) return;

    if (isCardSelected(card)) {
      // Double click / second click plays the card
      if (isCardPlayable(card)) {
        onPlayCard(card);
      }
    } else {
      onSelectCard(card);
    }
  };

  // Calculate fan layout - responsive spread
  const cardCount = sortedCards.length;
  const fanAngle = isMobile ? Math.min(cardCount * 4, 30) : Math.min(cardCount * 5, 40);
  const startAngle = -fanAngle / 2;

  return (
    <div
      className="relative flex justify-center items-end h-28 sm:h-40"
      role="group"
      aria-label={`Your hand: ${cardCount} cards${isMyTurn ? '. Your turn to play.' : ''}`}
    >
      <AnimatePresence mode="popLayout">
        {sortedCards.map((card, index) => {
          const playable = isCardPlayable(card);
          const selected = isCardSelected(card);

          // Calculate position in fan - responsive spread
          const angle = startAngle + (index / Math.max(cardCount - 1, 1)) * fanAngle;
          const baseSpread = isMobile ? 28 : 50;
          const xOffset = (index - (cardCount - 1) / 2) * baseSpread;

          // Simpler transitions for mobile
          const transition = isMobile
            ? { duration: 0.2, ease: 'easeOut', delay: index * 0.03 }
            : { type: 'spring', stiffness: 300, damping: 30, delay: index * 0.05 };

          return (
            <motion.div
              key={`${card.suit}-${card.rank}`}
              layout={!isMobile}
              initial={{ opacity: 0, y: 50, scale: 0.8 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                rotate: angle,
                x: xOffset,
              }}
              exit={{ opacity: 0, y: 50, scale: 0.8 }}
              transition={transition}
              style={{
                position: 'absolute',
                transformOrigin: 'bottom center',
                zIndex: selected ? 100 : index,
                willChange: 'transform',
                transform: 'translateZ(0)',
              }}
            >
              <Card
                card={card}
                isSelected={selected}
                isPlayable={playable && isMyTurn}
                onClick={() => handleCardClick(card)}
                size={isMobile ? 'md' : 'lg'}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Play hint */}
      {selectedCard && isCardPlayable(selectedCard) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -bottom-8 text-sm text-gold-400"
          aria-live="polite"
        >
          Click again to play
        </motion.div>
      )}
    </div>
  );
}

// Opponent hand (face down cards in a row)
interface OpponentHandProps {
  cardCount: number;
  position: 'left' | 'right' | 'top';
  playerName: string;
  isCurrentTurn?: boolean;
}

export function OpponentHand({
  cardCount,
  position,
  playerName,
  isCurrentTurn = false,
}: OpponentHandProps) {
  const isMobile = useIsMobile();

  const positionClasses = {
    left: 'flex-col items-start',
    right: 'flex-col items-end',
    top: 'flex-row items-center',
  };

  const cardDirection = position === 'top' ? 'horizontal' : 'vertical';

  return (
    <div
      className={cn('flex gap-2', positionClasses[position])}
      role="group"
      aria-label={`${playerName}'s hand: ${cardCount} cards${isCurrentTurn ? '. Their turn.' : ''}`}
    >
      {/* Player name */}
      <div
        className={cn(
          'text-sm font-medium px-2 py-1 rounded-lg bg-table-800/80',
          isCurrentTurn ? 'text-gold-400 ring-2 ring-gold-400/50' : 'text-white/80'
        )}
      >
        {playerName}
        {isCurrentTurn && (
          <motion.span
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="ml-2"
            aria-hidden="true"
          >
            •
          </motion.span>
        )}
        {isCurrentTurn && <span className="sr-only"> (their turn)</span>}
      </div>

      {/* Cards */}
      <div
        className={cn(
          'flex',
          cardDirection === 'vertical' ? 'flex-col -space-y-6 sm:-space-y-8' : '-space-x-4 sm:-space-x-6'
        )}
        aria-hidden="true"
      >
        {Array.from({ length: cardCount }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={isMobile ? { ...mobileTransition, delay: i * 0.02 } : { ...desktopTransition, delay: i * 0.05 }}
            className={cn(
              'w-7 h-10 sm:w-10 sm:h-14 rounded-md card-back will-change-transform',
              cardDirection === 'vertical' && 'rotate-90'
            )}
            style={{ transform: 'translateZ(0)' }}
          />
        ))}
      </div>
    </div>
  );
}

'use client';

import { useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from './Card';
import { cn } from '@/lib/utils';
import { useScreenSize } from '@/hooks/useIsMobile';
import type { Card as CardType, ValidAction, Suit } from '@tysiac/shared';

interface PlayerHandProps {
  cards: CardType[];
  validActions: ValidAction[];
  selectedCard: CardType | null;
  onSelectCard: (card: CardType | null) => void;
  onPlayCard: (card: CardType) => void;
  isMyTurn: boolean;
  declaredMarriages?: Suit[];
  phase?: string;
  trumpSuit?: Suit | null;
}

// Smooth easing for all devices (no springs)
const smoothTransition = { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] };

export function PlayerHand({
  cards,
  validActions,
  selectedCard,
  onSelectCard,
  onPlayCard,
  isMyTurn,
  declaredMarriages = [],
  phase,
  trumpSuit,
}: PlayerHandProps) {
  const { isMobile, width } = useScreenSize();

  // Get playable cards from valid actions
  const playableCards = useMemo(() => {
    const playAction = validActions.find((a) => a.type === 'playCard');
    if (playAction && playAction.type === 'playCard') {
      return playAction.validCards;
    }
    return [];
  }, [validActions]);

  // Detect undeclared marriages (K and Q of same suit that haven't been declared)
  const marriageCards = useMemo(() => {
    const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
    const marriageCardSet = new Set<string>();

    for (const suit of suits) {
      // Skip already declared marriages
      if (declaredMarriages.includes(suit)) continue;

      const hasKing = cards.some(c => c.suit === suit && c.rank === 'K');
      const hasQueen = cards.some(c => c.suit === suit && c.rank === 'Q');

      if (hasKing && hasQueen) {
        marriageCardSet.add(`${suit}-K`);
        marriageCardSet.add(`${suit}-Q`);
      }
    }

    return marriageCardSet;
  }, [cards, declaredMarriages]);

  const isMarriageCard = (card: CardType): boolean => {
    return marriageCards.has(`${card.suit}-${card.rank}`);
  };

  // Sort cards by suit and rank, ensuring red/black alternation when possible
  const sortedCards = useMemo(() => {
    const rankOrder = ['A', '10', 'K', 'Q', 'J', '9'];
    const isRedSuit = (suit: string) => suit === 'hearts' || suit === 'diamonds';
    const suitValue: Record<string, number> = { hearts: 100, diamonds: 80, clubs: 60, spades: 40 };

    // Find unique suits in hand
    const suitsInHand = Array.from(new Set(cards.map(c => c.suit)));

    // Determine optimal suit order to avoid same-color adjacency
    let suitOrder: string[];
    if (suitsInHand.length === 3) {
      // With 3 suits, arrange to alternate colors
      // Sort by marriage value (descending) so higher-value suits appear first (on left)
      const redSuits = suitsInHand.filter(isRedSuit).sort((a, b) => suitValue[b] - suitValue[a]);
      const blackSuits = suitsInHand.filter(s => !isRedSuit(s)).sort((a, b) => suitValue[b] - suitValue[a]);

      if (redSuits.length === 2) {
        // 2 red, 1 black: red, black, red
        suitOrder = [redSuits[0], blackSuits[0], redSuits[1]];
      } else if (blackSuits.length === 2) {
        // 2 black, 1 red: black, red, black
        suitOrder = [blackSuits[0], redSuits[0], blackSuits[1]];
      } else {
        // Should not happen with standard suits, fallback
        suitOrder = ['hearts', 'clubs', 'diamonds', 'spades'];
      }
    } else {
      // Default order for 4 suits (alternates red/black): hearts, clubs, diamonds, spades
      suitOrder = ['hearts', 'clubs', 'diamonds', 'spades'];
    }

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
      // Clicking selected card deselects it
      onSelectCard(null);
    } else {
      onSelectCard(card);
    }
  };

  // Track card count changes to sync animations when talon cards are added
  const prevCountRef = useRef(cards.length);
  const isHandGrowing = cards.length > prevCountRef.current;
  useEffect(() => { prevCountRef.current = cards.length; }, [cards.length]);

  const cardCount = sortedCards.length;

  // Card dimensions: sm=48px, md=64px, lg=80px
  const cardWidth = isMobile ? 64 : 80;

  // Calculate available width (screen width minus padding + safe area insets)
  const availableWidth = isMobile ? width - 48 : Math.min(width - 64, 700);

  // Calculate spread to fit all cards with minimum visibility
  // Each card needs at least 35px visible (to show rank/suit corner)
  const minVisibleWidth = isMobile ? 35 : 45;
  const totalNeededWidth = (cardCount - 1) * minVisibleWidth + cardWidth;

  // If cards fit with minimum visibility, use that; otherwise calculate tighter spread
  const baseSpread = cardCount <= 1
    ? 0
    : Math.min(
        (availableWidth - cardWidth) / (cardCount - 1),
        isMobile ? 52 : 70 // Max spread for aesthetic reasons
      );

  // No fan angle — flat layout on both desktop and mobile for consistency
  const fanAngle = 0;
  const startAngle = -fanAngle / 2;

  return (
    <div
      className={cn(
        "relative flex justify-center items-end",
        isMobile ? "h-32" : "h-40"
      )}
      style={{
        width: isMobile ? '100%' : 'auto',
        paddingLeft: isMobile ? 'max(8px, env(safe-area-inset-left))' : undefined,
        paddingRight: isMobile ? 'max(8px, env(safe-area-inset-right))' : undefined,
        paddingBottom: isMobile ? 'env(safe-area-inset-bottom)' : undefined,
      }}
      role="group"
      aria-label={`Your hand: ${cardCount} cards${isMyTurn ? '. Your turn to play.' : ''}`}
    >
      <AnimatePresence>
        {sortedCards.map((card, index) => {
          const playable = isCardPlayable(card);
          const selected = isCardSelected(card);

          // Calculate position
          const angle = startAngle + (index / Math.max(cardCount - 1, 1)) * fanAngle;
          const xOffset = (index - (cardCount - 1) / 2) * baseSpread;

          // Smooth easing transitions (no springs to avoid jitter)
          const transition = {
            duration: isMobile ? 0.2 : 0.25,
            ease: [0.25, 0.1, 0.25, 1],
            delay: isHandGrowing ? 0 : index * 0.02
          };

          const isPlayableNow = playable && isMyTurn;

          return (
            <motion.div
              key={`${card.suit}-${card.rank}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{
                opacity: 1,
                y: 0,
                rotate: angle,
                x: xOffset,
              }}
              exit={{ opacity: 0 }}
              transition={transition}
              style={{
                position: 'absolute',
                transformOrigin: 'bottom center',
                zIndex: selected ? 100 : index,
              }}
              className="relative"
            >
              <Card
                card={card}
                isSelected={selected}
                isPlayable={isPlayableNow}
                isMarriageCard={isMarriageCard(card)}
                isTrumpCard={!!trumpSuit && card.suit === trumpSuit}
                onClick={() => handleCardClick(card)}
                size={isMobile ? 'md' : 'lg'}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>

    </div>
  );
}

'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card } from './Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { Card as CardType, GamePlayer, Suit } from '@tysiac/shared';

interface DistributionModalProps {
  hand: CardType[];
  otherPlayers: GamePlayer[];
  onDistribute: (distribution: { playerId: string; card: CardType }[]) => void;
}

export function DistributionModal({
  hand,
  otherPlayers,
  onDistribute,
}: DistributionModalProps) {
  const isMobile = useIsMobile();
  const [activeSlot, setActiveSlot] = useState<string>(otherPlayers[0]?.id || '');
  const [assignments, setAssignments] = useState<Map<string, CardType>>(new Map());
  const [submitted, setSubmitted] = useState(false);

  // Detect marriages (K and Q of same suit both in hand)
  const marriageCards = useMemo(() => {
    const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
    const marriageCardSet = new Set<string>();

    for (const suit of suits) {
      const hasKing = hand.some(c => c.suit === suit && c.rank === 'K');
      const hasQueen = hand.some(c => c.suit === suit && c.rank === 'Q');

      if (hasKing && hasQueen) {
        marriageCardSet.add(`${suit}-K`);
        marriageCardSet.add(`${suit}-Q`);
      }
    }

    return marriageCardSet;
  }, [hand]);

  const isMarriageCard = (card: CardType): boolean => {
    return marriageCards.has(`${card.suit}-${card.rank}`);
  };

  // Sort cards by suit (alternating red/black) and rank
  const sortedCards = useMemo(() => {
    const rankOrder = ['A', '10', 'K', 'Q', 'J', '9'];
    const isRedSuit = (suit: string) => suit === 'hearts' || suit === 'diamonds';
    const suitsInHand = Array.from(new Set(hand.map(c => c.suit)));

    let suitOrder: string[];
    if (suitsInHand.length === 3) {
      const redSuits = suitsInHand.filter(isRedSuit).sort();
      const blackSuits = suitsInHand.filter(s => !isRedSuit(s)).sort();
      suitOrder = redSuits.length === 2
        ? [redSuits[0], blackSuits[0], redSuits[1]]
        : [blackSuits[0], redSuits[0], blackSuits[1]];
    } else {
      suitOrder = ['hearts', 'clubs', 'diamonds', 'spades'];
    }

    return [...hand].sort((a, b) => {
      const suitDiff = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
      if (suitDiff !== 0) return suitDiff;
      return rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank);
    });
  }, [hand]);

  // Find which player a card is assigned to
  const getAssignedPlayer = (card: CardType): string | null => {
    let found: string | null = null;
    assignments.forEach((assigned, playerId) => {
      if (assigned.suit === card.suit && assigned.rank === card.rank) {
        found = playerId;
      }
    });
    return found;
  };

  const handleCardClick = (card: CardType) => {
    if (submitted) return;

    const currentAssignee = getAssignedPlayer(card);

    if (currentAssignee) {
      // Unassign the card
      const next = new Map(assignments);
      next.delete(currentAssignee);
      setAssignments(next);
      // Activate the now-empty slot
      setActiveSlot(currentAssignee);
      return;
    }

    if (!activeSlot) return;

    // Assign card to active slot
    const next = new Map(assignments);
    next.set(activeSlot, card);
    setAssignments(next);

    // Auto-advance to next empty slot
    const nextEmpty = otherPlayers.find(p => !next.has(p.id));
    setActiveSlot(nextEmpty?.id || '');
  };

  const handleSlotClick = (playerId: string) => {
    if (submitted) return;

    if (assignments.has(playerId)) {
      // Clear this slot
      const next = new Map(assignments);
      next.delete(playerId);
      setAssignments(next);
      setActiveSlot(playerId);
    } else {
      setActiveSlot(playerId);
    }
  };

  const canSubmit = assignments.size === 2;

  const handleConfirm = () => {
    if (!canSubmit || submitted) return;
    setSubmitted(true);
    const distribution: { playerId: string; card: CardType }[] = [];
    assignments.forEach((card, playerId) => {
      distribution.push({ playerId, card });
    });
    onDistribute(distribution);
  };

  const cardSize = isMobile ? 'sm' : 'md';
  const slotCardSize = isMobile ? 'sm' : 'md';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative z-10 w-full max-w-md sm:max-w-lg bg-gradient-to-b from-table-800 to-table-900 border border-table-600 rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Decorative gold glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-gold-500/10 via-transparent to-transparent pointer-events-none" />

        <div className="relative px-4 sm:px-8 py-5 sm:py-6">
          {/* Header */}
          <div className="text-center mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gold-300 via-gold-400 to-amber-500">
              Distribute Cards
            </h2>
            <p className="text-xs sm:text-sm text-white/50 mt-1">
              Give 1 card to each player
            </p>
          </div>

          {/* Gold separator */}
          <div className="h-px bg-gradient-to-r from-transparent via-gold-400/30 to-transparent mb-4" />

          {/* Cards grid — always 5 columns, 2 rows */}
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2 justify-items-center mb-5">
            {sortedCards.map((card, index) => {
              const assignedTo = getAssignedPlayer(card);
              const assignedName = assignedTo
                ? otherPlayers.find(p => p.id === assignedTo)?.name
                : null;

              return (
                <motion.div
                  key={`${card.suit}-${card.rank}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.03 }}
                  className="relative"
                >
                  <div
                    className={cn(
                      'rounded-lg transition-all duration-150 cursor-pointer',
                      assignedTo
                        ? 'ring-2 ring-gold-400 opacity-50'
                        : activeSlot
                          ? 'hover:ring-2 hover:ring-white/40'
                          : 'opacity-70 cursor-default'
                    )}
                    onClick={() => handleCardClick(card)}
                  >
                    <Card
                      card={card}
                      size={cardSize}
                      isPlayable={!assignedTo && !!activeSlot && !submitted}
                      isMarriageCard={isMarriageCard(card)}
                    />
                  </div>
                  {/* Assigned label — fixed height to prevent shift */}
                  <div className="h-4 mt-0.5 flex items-center justify-center">
                    {assignedName && (
                      <span className="text-[10px] text-gold-400 font-medium truncate max-w-[3.5rem] sm:max-w-[4.5rem]">
                        → {assignedName}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Gold separator */}
          <div className="h-px bg-gradient-to-r from-transparent via-table-600 to-transparent mb-4" />

          {/* Player slots */}
          <div className="flex gap-3 sm:gap-4 justify-center mb-5">
            {otherPlayers.slice(0, 2).map((player) => {
              const assignedCard = assignments.get(player.id);
              const isActive = activeSlot === player.id && !submitted;

              return (
                <button
                  key={player.id}
                  onClick={() => handleSlotClick(player.id)}
                  disabled={submitted}
                  className={cn(
                    'flex flex-col items-center gap-2 p-2.5 sm:p-3 rounded-xl transition-all duration-150',
                    isActive
                      ? 'bg-gold-500/15 ring-2 ring-gold-400'
                      : assignedCard
                        ? 'bg-white/[0.04] ring-1 ring-gold-400/40'
                        : 'bg-white/[0.04] ring-1 ring-white/10',
                    !submitted && 'hover:bg-white/[0.06]'
                  )}
                >
                  {/* Player name */}
                  <span className={cn(
                    'text-xs sm:text-sm font-semibold truncate max-w-[5rem] sm:max-w-[7rem]',
                    isActive ? 'text-gold-400' : 'text-white/80'
                  )} title={player.name}>
                    {player.name}
                  </span>

                  {/* Card slot — fixed size to prevent layout shift */}
                  <div className={cn(
                    'flex items-center justify-center rounded-lg',
                    isMobile ? 'w-14 h-[84px]' : 'w-16 h-[96px]',
                    !assignedCard && 'border-2 border-dashed',
                    isActive && !assignedCard
                      ? 'border-gold-400/50 bg-gold-500/5'
                      : !assignedCard
                        ? 'border-white/15 bg-white/[0.02]'
                        : ''
                  )}>
                    {assignedCard ? (
                      <Card card={assignedCard} size={slotCardSize} isPlayable={false} />
                    ) : (
                      <span className={cn(
                        'text-xs',
                        isActive ? 'text-gold-400/50' : 'text-white/20'
                      )}>
                        ?
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Confirm button — always rendered, just enabled/disabled */}
          <div className="flex justify-center">
            <Button
              variant="primary"
              onClick={handleConfirm}
              disabled={!canSubmit || submitted}
              glow={canSubmit && !submitted}
              className="min-w-[140px]"
            >
              {submitted ? 'Waiting...' : 'Confirm'}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

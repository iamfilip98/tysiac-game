'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from './Card';
import { Button } from '@/components/ui/Button';
import { ElectricBorder } from '@/components/ui/ElectricBorder';
import { cn } from '@/lib/utils';
import type { Card as CardType, GamePlayer } from '@tysiac/shared';

interface TalonDisplayProps {
  talon: CardType[];
  isRevealed: boolean;
}

export function TalonDisplay({ talon, isRevealed }: TalonDisplayProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      <AnimatePresence mode="wait">
        {isRevealed ? (
          // Revealed talon cards
          talon.map((card, i) => (
            <motion.div
              key={`${card.suit}-${card.rank}`}
              initial={{ rotateY: 180, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: i * 0.2, duration: 0.5 }}
            >
              <Card card={card} size="md" isPlayable={false} />
            </motion.div>
          ))
        ) : (
          // Face down talon
          Array.from({ length: 3 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ rotateY: 180, opacity: 0 }}
              transition={{ delay: i * 0.1 }}
              className="w-16 h-24 rounded-lg card-back"
            />
          ))
        )}
      </AnimatePresence>
    </div>
  );
}

interface TalonDistributionPanelProps {
  myHand: CardType[];
  otherPlayers: GamePlayer[];
  onDistribute: (distribution: { playerId: string; card: CardType }[]) => void;
}

export function TalonDistributionPanel({
  myHand,
  otherPlayers,
  onDistribute,
}: TalonDistributionPanelProps) {
  const [selectedCards, setSelectedCards] = useState<Map<string, CardType>>(
    new Map()
  );

  const [currentTarget, setCurrentTarget] = useState<string | null>(null);

  // Sort hand for display (same order as PlayerHand)
  const sortedHand = useMemo(() => {
    const suitOrder = ['hearts', 'clubs', 'diamonds', 'spades'];
    const rankOrder = ['A', '10', 'K', 'Q', 'J', '9'];

    return [...myHand].sort((a, b) => {
      const suitDiff = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
      if (suitDiff !== 0) return suitDiff;
      return rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank);
    });
  }, [myHand]);

  const handleCardSelect = (card: CardType) => {
    if (!currentTarget) return;

    const newSelected = new Map(selectedCards);

    // Check if card is already selected for someone else
    newSelected.forEach((selectedCard, playerId) => {
      if (selectedCard.suit === card.suit && selectedCard.rank === card.rank) {
        // Remove it from previous assignment
        newSelected.delete(playerId);
      }
    });

    // Assign to current target
    newSelected.set(currentTarget, card);
    setSelectedCards(newSelected);

    // Auto-switch to next player without a card
    const nextPlayer = otherPlayers.find((p) => !newSelected.has(p.id));
    setCurrentTarget(nextPlayer?.id || null);
  };

  const isCardSelected = (card: CardType) => {
    let found = false;
    selectedCards.forEach((selectedCard) => {
      if (selectedCard.suit === card.suit && selectedCard.rank === card.rank) {
        found = true;
      }
    });
    return found;
  };

  const getCardAssignee = (card: CardType) => {
    let assignee: string | null = null;
    selectedCards.forEach((selectedCard, playerId) => {
      if (selectedCard.suit === card.suit && selectedCard.rank === card.rank) {
        assignee = otherPlayers.find((p) => p.id === playerId)?.name || null;
      }
    });
    return assignee;
  };

  const canSubmit = selectedCards.size === 2;

  const handleSubmit = () => {
    const distribution: { playerId: string; card: CardType }[] = [];
    selectedCards.forEach((card, playerId) => {
      distribution.push({ playerId, card });
    });
    onDistribute(distribution);
  };

  return (
    <ElectricBorder active color="#22c55e">
      <div className="bg-table-900/90 backdrop-blur p-4 sm:p-6 rounded-xl max-w-2xl">
        <div className="text-center mb-4">
          <h3 className="text-lg sm:text-xl font-bold text-white mb-2">
            Distribute Talon Cards
          </h3>
          <p className="text-xs sm:text-sm text-white/60">
            Select a player, then click a card to give them
          </p>
        </div>

        {/* Player selection */}
        <div className="flex justify-center gap-2 sm:gap-4 mb-4 sm:mb-6">
          {otherPlayers.map((player) => {
            const assignedCard = selectedCards.get(player.id);
            const isSelected = currentTarget === player.id;

            return (
              <motion.button
                key={player.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setCurrentTarget(player.id)}
                className={cn(
                  'px-3 sm:px-4 py-2 sm:py-3 rounded-lg sm:rounded-xl transition-all min-w-[100px] sm:min-w-[120px]',
                  isSelected
                    ? 'bg-gold-500 text-table-950 ring-2 ring-gold-300'
                    : 'bg-table-800 text-white hover:bg-table-700',
                  assignedCard && !isSelected && 'ring-2 ring-green-500'
                )}
              >
                <div className="font-medium">{player.name}</div>
                {assignedCard && (
                  <div className="text-xs mt-1 opacity-80">
                    Gets: {assignedCard.rank}
                    {assignedCard.suit[0].toUpperCase()}
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Card selection */}
        <div className="flex flex-wrap justify-center gap-1 sm:gap-2 mb-4 sm:mb-6">
          {sortedHand.map((card) => {
            const selected = isCardSelected(card);
            const assignee = getCardAssignee(card);

            return (
              <motion.div
                key={`${card.suit}-${card.rank}`}
                whileHover={{ y: -4 }}
                className="relative"
              >
                <Card
                  card={card}
                  size="md"
                  isSelected={selected}
                  isPlayable={!!currentTarget}
                  onClick={() => handleCardSelect(card)}
                />
                {assignee && (
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-xs bg-green-600 text-white px-2 py-0.5 rounded whitespace-nowrap">
                    → {assignee}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Submit button */}
        <div className="flex justify-center">
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!canSubmit}
            glow={canSubmit}
            size="lg"
          >
            Confirm Distribution
          </Button>
        </div>
      </div>
    </ElectricBorder>
  );
}

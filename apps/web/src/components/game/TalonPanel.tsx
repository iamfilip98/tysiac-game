'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Card } from './Card';
import { Button } from '@/components/ui/Button';
import { ElectricBorder } from '@/components/ui/ElectricBorder';
import { cn, truncateName } from '@/lib/utils';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { Card as CardType, GamePlayer } from '@tysiac/shared';

interface TalonDisplayProps {
  talon: CardType[];
  isRevealed: boolean;
}

export function TalonDisplay({ talon, isRevealed }: TalonDisplayProps) {
  const isMobile = useIsMobile();

  return (
    <div className="flex items-center justify-center gap-2">
      <AnimatePresence mode="wait">
        {isRevealed ? (
          // Revealed talon cards with 3D flip animation
          talon.map((card, i) => (
            <div
              key={`${card.suit}-${card.rank}`}
              style={{ perspective: '600px' }}
            >
              <motion.div
                initial={{ rotateY: 180, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  rotateY: { delay: i * 0.2, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] },
                  opacity: { delay: i * 0.2, duration: 0.15 },
                }}
                style={{ willChange: 'transform, opacity', transformStyle: 'preserve-3d' }}
              >
                <Card card={card} size="md" isPlayable={false} />
              </motion.div>
            </div>
          ))
        ) : (
          // Face down talon
          Array.from({ length: 3 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{
                delay: i * 0.08,
                duration: 0.2,
                ease: 'easeOut'
              }}
              className="w-16 h-24 rounded-lg card-back"
              style={{ willChange: 'opacity, transform' }}
            />
          ))
        )}
      </AnimatePresence>
    </div>
  );
}

interface TalonDistributionPanelProps {
  otherPlayers: GamePlayer[];
  selectedCards: Map<string, CardType>;
  currentTarget: string | null;
  onSelectTarget: (playerId: string) => void;
  onDistribute: () => void;
}

export function TalonDistributionPanel({
  otherPlayers,
  selectedCards,
  currentTarget,
  onSelectTarget,
  onDistribute,
}: TalonDistributionPanelProps) {
  const canSubmit = selectedCards.size === 2;

  return (
    <ElectricBorder active color="#22c55e">
      <div className="bg-table-900/90 backdrop-blur p-3 sm:p-4 rounded-xl">
        <div className="text-center mb-3">
          <h3 className="text-sm sm:text-base font-bold text-white">
            Give 1 card to each player
          </h3>
          <p className="text-xs text-white/60 mt-1">
            {currentTarget ? 'Click a card in your hand' : 'Select a player below'}
          </p>
        </div>

        {/* Player selection + Submit in a row */}
        <div className="flex items-center justify-center gap-2 sm:gap-3">
          {otherPlayers.map((player) => {
            const assignedCard = selectedCards.get(player.id);
            const isSelected = currentTarget === player.id;

            return (
              <motion.button
                key={player.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelectTarget(player.id)}
                className={cn(
                  'px-3 py-2 rounded-lg transition-all min-w-[90px] sm:min-w-[100px]',
                  isSelected
                    ? 'bg-gold-500 text-table-950 ring-2 ring-gold-300'
                    : 'bg-table-800 text-white hover:bg-table-700',
                  assignedCard && !isSelected && 'ring-2 ring-green-500'
                )}
                title={player.name}
              >
                <div className="font-medium text-sm">{truncateName(player.name)}</div>
              </motion.button>
            );
          })}

          <Button
            variant="primary"
            onClick={onDistribute}
            disabled={!canSubmit}
            glow={canSubmit}
            size="md"
            className="min-w-[90px] sm:min-w-[100px]"
          >
            Confirm
          </Button>
        </div>
      </div>
    </ElectricBorder>
  );
}

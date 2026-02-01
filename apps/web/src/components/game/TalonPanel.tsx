'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from './Card';
import { Button } from '@/components/ui/Button';
import { ElectricBorder } from '@/components/ui/ElectricBorder';
import { cn } from '@/lib/utils';
import type { Card as CardType, GamePlayer } from '@tysiac/shared';

const MAX_NAME_LENGTH = 10;

function truncateName(name: string): string {
  if (name.length <= MAX_NAME_LENGTH) return name;
  return name.slice(0, MAX_NAME_LENGTH) + '…';
}

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
          // Revealed talon cards - simple fade/scale animation (no 3D transforms)
          talon.map((card, i) => (
            <motion.div
              key={`${card.suit}-${card.rank}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                delay: i * 0.1,
                duration: 0.25,
                ease: 'easeOut'
              }}
              style={{ willChange: 'opacity, transform' }}
            >
              <Card card={card} size="md" isPlayable={false} />
            </motion.div>
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
                {assignedCard && (
                  <div className="text-xs mt-0.5 opacity-80">
                    {assignedCard.rank}{assignedCard.suit[0].toUpperCase()}
                  </div>
                )}
              </motion.button>
            );
          })}

          <Button
            variant="primary"
            onClick={onDistribute}
            disabled={!canSubmit}
            glow={canSubmit}
            size="md"
          >
            Confirm
          </Button>
        </div>
      </div>
    </ElectricBorder>
  );
}

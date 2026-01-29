'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { ElectricBorder } from '@/components/ui/ElectricBorder';
import { getSuitSymbol } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { Suit } from '@tysiac/shared';

interface MarriagePanelProps {
  availableSuits: Suit[];
  onDeclare: (suit: Suit) => void;
  onSkip: () => void;
}

const MARRIAGE_VALUES: Record<Suit, number> = {
  spades: 40,
  clubs: 60,
  diamonds: 80,
  hearts: 100,
};

export function MarriagePanel({
  availableSuits,
  onDeclare,
  onSkip,
}: MarriagePanelProps) {
  // Sort by value (highest first)
  const sortedSuits = [...availableSuits].sort(
    (a, b) => MARRIAGE_VALUES[b] - MARRIAGE_VALUES[a]
  );

  return (
    <ElectricBorder active color="#f59e0b">
      <div className="bg-table-900/90 backdrop-blur p-4 rounded-xl">
        <div className="text-center mb-4">
          <h3 className="text-lg font-bold text-gold-400">Declare Marriage?</h3>
          <p className="text-sm text-white/60">
            You can declare a marriage before playing
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mb-4">
          {sortedSuits.map((suit) => {
            const symbol = getSuitSymbol(suit);
            const value = MARRIAGE_VALUES[suit];
            const isRed = suit === 'hearts' || suit === 'diamonds';

            return (
              <motion.button
                key={suit}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onDeclare(suit)}
                className={cn(
                  'flex flex-col items-center gap-1 p-3 rounded-xl',
                  'bg-table-800 hover:bg-table-700 transition-all',
                  'border border-table-600 hover:border-gold-500/50'
                )}
              >
                <span
                  className={cn(
                    'text-3xl',
                    isRed ? 'text-red-500' : 'text-white'
                  )}
                >
                  {symbol}
                </span>
                <span className="text-gold-400 font-bold">+{value}</span>
              </motion.button>
            );
          })}
        </div>

        <div className="flex justify-center">
          <Button variant="ghost" onClick={onSkip} size="sm">
            Skip (play without declaring)
          </Button>
        </div>
      </div>
    </ElectricBorder>
  );
}

// Display for declared marriages
interface DeclaredMarriagesProps {
  marriages: Suit[];
  totalPoints: number;
}

export function DeclaredMarriages({
  marriages,
  totalPoints,
}: DeclaredMarriagesProps) {
  if (marriages.length === 0) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-white/60">Marriages:</span>
      {marriages.map((suit) => {
        const symbol = getSuitSymbol(suit);
        const isRed = suit === 'hearts' || suit === 'diamonds';

        return (
          <motion.span
            key={suit}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={cn(
              'text-xl',
              isRed ? 'text-red-500' : 'text-white'
            )}
          >
            {symbol}
          </motion.span>
        );
      })}
      <span className="text-gold-400 font-medium">+{totalPoints}</span>
    </div>
  );
}

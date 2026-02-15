'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { ElectricBorder } from '@/components/ui/ElectricBorder';

interface PlayOrPassPanelProps {
  onPlay: () => void;
  onPass: () => void;
  isMyTurn: boolean;
  bidAmount?: number;
  playerCount?: number;
}

export function PlayOrPassPanel({ onPlay, onPass, isMyTurn, bidAmount = 100, playerCount = 3 }: PlayOrPassPanelProps) {
  if (!isMyTurn) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center text-white/60 py-4"
      >
        Waiting for bid winner to decide...
      </motion.div>
    );
  }

  const isNoPenalty = bidAmount === 100;
  // Calculate points per player: 120 distributed among active players minus bidder
  // In 4-player mode, dealer sits out, so 2 active opponents. In 3-player, 2 opponents.
  const pointsPerOpponent = playerCount === 4 ? 60 : 60;

  return (
    <ElectricBorder active color="#fbbf24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-4 py-3 bg-table-900/90 rounded-xl"
      >
        <h3 className="text-base font-bold text-gold-400 text-center mb-1">
          You won the bid at {bidAmount}
        </h3>
        <p className="text-white/60 text-center text-sm mb-2">
          {isNoPenalty
            ? 'Throw = no points change.'
            : `Throw = you lose ${bidAmount}, others gain +${pointsPerOpponent} each.`}
        </p>
        <div className="flex gap-3 justify-center">
          <Button
            variant="secondary"
            onClick={onPass}
            className="px-8"
          >
            {isNoPenalty ? 'Throw' : `Throw (-${bidAmount})`}
          </Button>
          <Button
            variant="primary"
            onClick={onPlay}
            glow
            className="px-8"
          >
            Play!
          </Button>
        </div>
      </motion.div>
    </ElectricBorder>
  );
}

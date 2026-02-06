'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TurnIndicatorProps {
  playerName: string;
  isMyTurn: boolean;
  phase: string;
}

export function TurnIndicator({ playerName, isMyTurn, phase }: TurnIndicatorProps) {
  const getMessage = () => {
    if (isMyTurn) {
      switch (phase) {
        case 'bidding':
          return 'Your turn to bid';
        case 'talonDistribution':
          return 'Distribute the talon cards';
        case 'trickPlaying':
          return 'Your turn to play';
        default:
          return 'Your turn';
      }
    }
    return `Waiting for ${playerName}...`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2 rounded-full',
        'text-sm font-medium',
        isMyTurn
          ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30'
          : 'bg-table-800/80 text-white/60'
      )}
    >
      {isMyTurn ? (
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [1, 0.8, 1],
          }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-2 h-2 bg-gold-400 rounded-full"
        />
      ) : (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full"
        />
      )}
      {getMessage()}
    </motion.div>
  );
}

// Phase indicator
interface PhaseIndicatorProps {
  phase: string;
  roundNumber?: number;
  trickNumber?: number;
}

export function PhaseIndicator({ phase, roundNumber, trickNumber }: PhaseIndicatorProps) {
  const getPhaseDisplay = () => {
    switch (phase) {
      case 'idle':
        return 'Waiting to start';
      case 'dealing':
        return 'Dealing cards...';
      case 'bidding':
        return 'Bidding';
      case 'talonReveal':
        return 'Revealing talon';
      case 'talonDistribution':
        return 'Card distribution';
      case 'trickPlaying':
        return trickNumber ? `Trick ${trickNumber} of 8` : 'Playing tricks';
      case 'roundScoring':
        return 'Scoring round';
      case 'gameEnd':
        return 'Game over!';
      default:
        return phase;
    }
  };

  return (
    <div className="text-center">
      {roundNumber && (
        <div className="text-xs text-white/70 mb-1">Round {roundNumber}</div>
      )}
      <div className="text-sm font-medium text-white/80">{getPhaseDisplay()}</div>
    </div>
  );
}

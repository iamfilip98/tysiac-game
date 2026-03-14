import { motion, AnimatePresence } from 'framer-motion';
import { BiddingPanel } from './BiddingPanel';
import { PlayOrPassPanel } from './PlayOrPassPanel';
import type { ValidAction } from '@tysiac/shared';

interface GameActionPanelsProps {
  phase: string;
  validActions: ValidAction[];
  currentBid: number;
  onBid: (amount: number) => void;
  onPass: () => void;
  isMyTurn: boolean;
  onPlayOrPass: (decision: 'play' | 'pass') => void;
  isBidWinner: boolean;
  bidAmount: number;
  playerCount: number;
  bidWinnerName?: string;
}

export function GameActionPanels({
  phase,
  validActions,
  currentBid,
  onBid,
  onPass,
  isMyTurn,
  onPlayOrPass,
  isBidWinner,
  bidAmount,
  playerCount,
  bidWinnerName,
}: GameActionPanelsProps) {
  return (
    <AnimatePresence mode="wait">
      {/* Bidding panel */}
      {phase === 'bidding' && (
        <motion.div
          key="bidding"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <BiddingPanel
            validActions={validActions}
            currentBid={currentBid}
            onBid={onBid}
            onPass={onPass}
            isMyTurn={isMyTurn}
          />
        </motion.div>
      )}

      {/* Play or Pass decision */}
      {phase === 'playOrPassDecision' && (
        <motion.div
          key="playOrPass"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <PlayOrPassPanel
            onPlay={() => onPlayOrPass('play')}
            onPass={() => onPlayOrPass('pass')}
            isMyTurn={(isMyTurn || validActions.some(a => a.type === 'playOrPass')) && isBidWinner}
            bidAmount={bidAmount}
            playerCount={playerCount}
          />
        </motion.div>
      )}

      {/* Waiting for bid winner to distribute */}
      {phase === 'talonDistribution' && !isBidWinner && (
        <motion.div
          key="distribution-waiting"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="text-center text-white/60 py-4"
        >
          Waiting for {bidWinnerName || 'bid winner'} to distribute cards...
        </motion.div>
      )}

    </AnimatePresence>
  );
}

import { motion, AnimatePresence } from 'framer-motion';
import { BiddingPanel } from './BiddingPanel';
import { PlayOrPassPanel } from './PlayOrPassPanel';
import { TalonDistributionPanel } from './TalonPanel';
import type { ValidAction, Card as CardType, GamePlayer } from '@tysiac/shared';

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
  // Talon distribution props
  hasCardsToDistribute: boolean;
  otherPlayers: GamePlayer[];
  distributionCards: Map<string, CardType>;
  distributionTarget: string | null;
  onSelectTarget: (id: string) => void;
  onDistributeSubmit: () => void;
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
  hasCardsToDistribute,
  otherPlayers,
  distributionCards,
  distributionTarget,
  onSelectTarget,
  onDistributeSubmit,
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

      {/* Talon distribution */}
      {phase === 'talonDistribution' &&
        isBidWinner &&
        hasCardsToDistribute && (
          <motion.div
            key="distribution"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <TalonDistributionPanel
              otherPlayers={otherPlayers}
              selectedCards={distributionCards}
              currentTarget={distributionTarget}
              onSelectTarget={onSelectTarget}
              onDistribute={onDistributeSubmit}
            />
          </motion.div>
        )}

      {/* Waiting for bid winner to distribute */}
      {phase === 'talonDistribution' && !isBidWinner && (
        <motion.div
          key="distribution-waiting"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="flex items-center gap-2 text-white/60 text-sm"
        >
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Waiting for {bidWinnerName || 'bid winner'} to distribute cards...
        </motion.div>
      )}

    </AnimatePresence>
  );
}

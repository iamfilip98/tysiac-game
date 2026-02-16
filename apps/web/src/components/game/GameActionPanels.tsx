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

    </AnimatePresence>
  );
}

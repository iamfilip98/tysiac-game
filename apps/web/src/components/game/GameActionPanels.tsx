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
          className="bg-gradient-to-b from-table-800/85 to-table-900/85 backdrop-blur-md border border-white/[0.08] rounded-xl p-4 text-center"
          style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}
        >
          <div className="text-white/60 flex items-center justify-center gap-2">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full"
            />
            Waiting for {bidWinnerName || 'bid winner'} to distribute cards...
          </div>
        </motion.div>
      )}

    </AnimatePresence>
  );
}

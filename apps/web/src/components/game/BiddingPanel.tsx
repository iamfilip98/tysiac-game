'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { ElectricBorder } from '@/components/ui/ElectricBorder';
import type { ValidAction } from '@tysiac/shared';

interface BiddingPanelProps {
  validActions: ValidAction[];
  currentBid: number;
  onBid: (amount: number) => void;
  onPass: () => void;
  isMyTurn: boolean;
}

export function BiddingPanel({
  validActions,
  currentBid,
  onBid,
  onPass,
  isMyTurn,
}: BiddingPanelProps) {
  const [isBidding, setIsBidding] = useState(false);
  const [isPassing, setIsPassing] = useState(false);

  const bidAction = validActions.find((a) => a.type === 'bid');
  const canPass = validActions.some((a) => a.type === 'pass');

  // Next bid is always current + 10
  const nextBid = useMemo(() => {
    if (bidAction && bidAction.type === 'bid') {
      return bidAction.minBid;
    }
    return currentBid + 10;
  }, [bidAction, currentBid]);

  // Check if player can still bid (hasn't exceeded max based on marriages)
  const canBid = useMemo(() => {
    if (!bidAction || bidAction.type !== 'bid') return false;
    return nextBid <= bidAction.maxBid;
  }, [bidAction, nextBid]);

  const handleBid = () => {
    if (canBid && !isBidding) {
      setIsBidding(true);
      onBid(nextBid);
      setTimeout(() => setIsBidding(false), 2000);
    }
  };

  const handlePass = () => {
    if (!isPassing) {
      setIsPassing(true);
      onPass();
      setTimeout(() => setIsPassing(false), 2000);
    }
  };

  if (!isMyTurn) {
    return (
      <div className="bg-table-900/80 border border-table-600 rounded-xl p-4 text-center">
        <div className="text-white/60">Waiting for other players to bid...</div>
        <div className="mt-2 text-lg font-medium text-gold-400">
          Current bid: {currentBid}
        </div>
      </div>
    );
  }

  return (
    <ElectricBorder active={isMyTurn} color="#22c55e">
      <div className="bg-table-900/90 backdrop-blur p-4 rounded-xl min-w-[280px]">
        <div className="text-center mb-4">
          <div className="text-sm text-white/60 mb-1">Your turn to bid</div>
          <div className="text-2xl font-bold text-gold-400">
            Current: {currentBid}
          </div>
        </div>

        {/* Simple two-button layout: Pass or Bid +10 */}
        <div className="flex gap-3">
          {canPass && (
            <motion.div className="flex-1 basis-0" whileTap={{ scale: 0.98 }}>
              <Button
                variant="secondary"
                onClick={handlePass}
                disabled={isPassing}
                className="w-full py-3 text-lg"
                aria-busy={isPassing}
              >
                {isPassing ? 'Passing...' : 'Pass'}
              </Button>
            </motion.div>
          )}
          {canBid && (
            <motion.div className="flex-1 basis-0" whileTap={{ scale: 0.98 }}>
              <Button
                variant="primary"
                onClick={handleBid}
                disabled={isBidding}
                className="w-full py-3 text-lg"
                glow={!isBidding}
                aria-busy={isBidding}
              >
                {isBidding ? 'Bidding...' : `Bid ${nextBid}`}
              </Button>
            </motion.div>
          )}
        </div>

        {/* Show max bid info */}
        {bidAction && bidAction.type === 'bid' && (
          <div className="mt-3 text-center text-xs text-white/50">
            You can bid up to {bidAction.maxBid} based on your marriages
          </div>
        )}
      </div>
    </ElectricBorder>
  );
}

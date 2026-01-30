'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { ElectricBorder } from '@/components/ui/ElectricBorder';
import { cn } from '@/lib/utils';
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
  const [selectedBid, setSelectedBid] = useState<number | null>(null);
  const [isBidding, setIsBidding] = useState(false);
  const [isPassing, setIsPassing] = useState(false);

  const bidAction = validActions.find((a) => a.type === 'bid');
  const canPass = validActions.some((a) => a.type === 'pass');

  const { minBid, maxBid } = useMemo(() => {
    if (bidAction && bidAction.type === 'bid') {
      return { minBid: bidAction.minBid, maxBid: bidAction.maxBid };
    }
    return { minBid: 110, maxBid: 120 };
  }, [bidAction]);

  // Generate bid options
  const bidOptions = useMemo(() => {
    const options: number[] = [];
    for (let bid = minBid; bid <= maxBid; bid += 10) {
      options.push(bid);
    }
    return options;
  }, [minBid, maxBid]);

  const handleBid = () => {
    if (selectedBid && !isBidding) {
      setIsBidding(true);
      onBid(selectedBid);
      setSelectedBid(null);
      // Reset after timeout in case of failure
      setTimeout(() => setIsBidding(false), 2000);
    }
  };

  const handlePass = () => {
    if (!isPassing) {
      setIsPassing(true);
      onPass();
      // Reset after timeout in case of failure
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
      <div className="bg-table-900/90 backdrop-blur p-4 rounded-xl">
        <div className="text-center mb-4">
          <div className="text-sm text-white/60 mb-1">Your turn to bid</div>
          <div className="text-xl font-bold text-gold-400">
            Current: {currentBid}
          </div>
        </div>

        {/* Bid options grid */}
        {bidAction && (
          <div className="grid grid-cols-4 gap-2 mb-4">
            {bidOptions.map((bid) => (
              <motion.button
                key={bid}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedBid(bid)}
                className={cn(
                  'py-2 px-3 rounded-lg font-medium transition-all',
                  selectedBid === bid
                    ? 'bg-gold-500 text-table-950'
                    : 'bg-table-800 text-white hover:bg-table-700'
                )}
              >
                {bid}
              </motion.button>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          {canPass && (
            <Button
              variant="secondary"
              onClick={handlePass}
              disabled={isPassing}
              className="flex-1"
              aria-busy={isPassing}
            >
              {isPassing ? 'Passing...' : 'Pass'}
            </Button>
          )}
          {bidAction && (
            <Button
              variant="primary"
              onClick={handleBid}
              disabled={!selectedBid || isBidding}
              className="flex-1"
              glow={!isBidding && !!selectedBid}
              aria-busy={isBidding}
            >
              {isBidding ? 'Bidding...' : `Bid ${selectedBid || '...'}`}
            </Button>
          )}
        </div>

        {/* Max bid hint */}
        <div className="mt-3 text-center text-xs text-white/60">
          Max bid: {maxBid} (based on marriages in hand)
        </div>
      </div>
    </ElectricBorder>
  );
}

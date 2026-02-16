'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
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
  const bidTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const passTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (bidTimeoutRef.current) clearTimeout(bidTimeoutRef.current);
      if (passTimeoutRef.current) clearTimeout(passTimeoutRef.current);
    };
  }, []);

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
      bidTimeoutRef.current = setTimeout(() => setIsBidding(false), 2000);
    }
  };

  const handlePass = () => {
    if (!isPassing) {
      setIsPassing(true);
      onPass();
      passTimeoutRef.current = setTimeout(() => setIsPassing(false), 2000);
    }
  };

  if (!isMyTurn) {
    return (
      <div className="bg-gradient-to-b from-table-800/85 to-table-900/85 backdrop-blur-md border border-white/[0.08] rounded-xl p-4 text-center" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}>
        <div className="text-white/60 flex items-center justify-center gap-2">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full"
          />
          Waiting for other players to bid...
        </div>
        <div className="mt-2 text-lg font-medium text-gold-400">
          Current bid: {currentBid}
        </div>
      </div>
    );
  }

  return (
    <ElectricBorder active={isMyTurn} color="#fbbf24">
      <div className="bg-gradient-to-b from-table-800/90 to-table-900/90 backdrop-blur-md p-4 rounded-xl min-w-[280px]" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}>
        <div className="text-center mb-4">
          <div className="text-sm text-white/60 mb-1">Your turn to bid</div>
          <div className="text-2xl font-bold text-gold-400">
            Current: {currentBid}
          </div>
        </div>

        {/* Two-button layout when can bid, full-width pass when can't */}
        {canBid ? (
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="secondary"
              onClick={handlePass}
              disabled={isPassing || !canPass}
              className="py-3 text-lg"
              aria-busy={isPassing}
            >
              {isPassing ? 'Passing...' : 'Pass'}
            </Button>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
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
          </div>
        ) : (
          <Button
            variant="primary"
            onClick={handlePass}
            disabled={isPassing || !canPass}
            className="w-full py-3 text-lg"
            glow={!isPassing && canPass}
            aria-busy={isPassing}
          >
            {isPassing ? 'Passing...' : 'Pass'}
          </Button>
        )}

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

'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [showTooltip, setShowTooltip] = useState(false);
  const bidTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const passTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (bidTimeoutRef.current) clearTimeout(bidTimeoutRef.current);
      if (passTimeoutRef.current) clearTimeout(passTimeoutRef.current);
      if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    };
  }, []);

  const toggleTooltip = useCallback(() => {
    setShowTooltip((prev) => {
      if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
      if (!prev) {
        tooltipTimeoutRef.current = setTimeout(() => setShowTooltip(false), 5000);
      }
      return !prev;
    });
  }, []);

  // Close tooltip on outside click
  useEffect(() => {
    if (!showTooltip) return;
    const handler = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setShowTooltip(false);
        if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showTooltip]);

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

        {/* Show max bid info with tooltip */}
        {bidAction && bidAction.type === 'bid' && (
          <div className="mt-3 text-center text-xs text-white/50 relative" ref={tooltipRef}>
            You can bid up to {bidAction.maxBid} based on your marriages
            <button
              onClick={toggleTooltip}
              className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/10 hover:bg-white/20 text-white/40 hover:text-white/70 text-[10px] font-bold transition-colors align-middle"
              aria-label="Marriage bid values info"
            >
              i
            </button>
            <AnimatePresence>
              {showTooltip && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-table-800 border border-white/10 rounded-lg p-2.5 text-xs text-white/70 whitespace-nowrap z-50 shadow-lg"
                >
                  Each King+Queen pair adds to max bid:
                  <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-white/60">
                    <span><span className="text-red-400">♥</span> Hearts: +100</span>
                    <span><span className="text-red-400">♦</span> Diamonds: +80</span>
                    <span><span className="text-white/80">♣</span> Clubs: +60</span>
                    <span><span className="text-white/80">♠</span> Spades: +40</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </ElectricBorder>
  );
}

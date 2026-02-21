'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getSuitSymbol, getSuitName } from '@tysiac/shared';
import type { Suit } from '@tysiac/shared';

function BarrelIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      {/* Barrel body */}
      <path d="M4 3 Q2.8 8 4 13 L12 13 Q13.2 8 12 3 Z" fill="#2a1f0a" stroke="#d4af37" strokeWidth="0.7" />
      {/* Metal bands */}
      <path d="M3.6 4.5 Q8 3.8 12.4 4.5" fill="none" stroke="#d4af37" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M3.2 8 Q8 7.2 12.8 8" fill="none" stroke="#d4af37" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M3.6 11.5 Q8 12.2 12.4 11.5" fill="none" stroke="#d4af37" strokeWidth="1.2" strokeLinecap="round" />
      {/* Top lid */}
      <ellipse cx="8" cy="3" rx="4" ry="1.3" fill="#2a1f0a" stroke="#d4af37" strokeWidth="0.7" />
    </svg>
  );
}

interface ScoreBoardProps {
  players: { id: string; name: string; isAI: boolean }[];
  scores: Record<
    string,
    { totalScore: number; roundScores: number[]; isOnBarrel: boolean }
  >;
  currentPlayerId: string;
  bidWinner?: string | null;
  finalBid?: number;
  trumpSuit?: Suit | null;
  dealerId?: string | null;
  roundNumber?: number;
  completedTricks?: number;
  phase?: string;
}

export const ScoreBoard = memo(function ScoreBoard({
  players,
  scores,
  currentPlayerId,
  bidWinner,
  finalBid,
  trumpSuit,
  dealerId,
  roundNumber,
  completedTricks,
  phase,
}: ScoreBoardProps) {
  const isFourPlayer = players.length === 4;

  return (
    <div className={cn(
      "bg-gradient-to-b from-table-800/90 to-table-900/90 backdrop-blur-md border border-white/[0.08] rounded-xl w-[220px] sm:w-[280px]",
      isFourPlayer ? "p-2" : "p-4"
    )} style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}>
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between border-b border-white/[0.08]",
        isFourPlayer ? "mb-1.5 pb-1" : "mb-3 pb-2"
      )}>
        <h3 className="text-sm font-semibold text-white/80">Scores</h3>
        {trumpSuit && (
          <div className="flex items-center gap-1 text-sm">
            <span className="text-white/60 text-xs">Trump:</span>
            <span
              className="text-base w-4 text-center"
              style={trumpSuit === 'hearts' || trumpSuit === 'diamonds'
                ? { color: 'var(--card-red)' }
                : { color: 'white' }}
              aria-label={getSuitName(trumpSuit)}
            >
              {getSuitSymbol(trumpSuit)}
            </span>
          </div>
        )}
      </div>

      {/* Players */}
      <div className={isFourPlayer ? "space-y-0.5" : "space-y-2"}>
        {players.map((player) => {
          const score = scores[player.id];
          const isMe = player.id === currentPlayerId;
          const isBidder = bidWinner === player.id;
          const isDealer = dealerId === player.id;

          return (
            <motion.div
              key={player.id}
              layout
              className={cn(
                'flex items-center justify-between rounded-lg',
                isFourPlayer ? 'p-1 px-1.5' : 'p-2',
                isMe && 'bg-gold-500/10 ring-1 ring-gold-500/30',
                isBidder && !isMe && 'bg-white/5'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                {/* Dealer indicator */}
                {isDealer && (
                  <span
                    className="w-5 h-5 flex items-center justify-center flex-shrink-0"
                    title="Dealer"
                    aria-label="Dealer"
                    style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      {/* Black base */}
                      <circle cx="10" cy="10" r="9" fill="#1a1a1a" />
                      {/* Gold alternating wedges (4 of 8 segments) */}
                      <path d="M10,10 L19,10 A9,9 0 0,1 16.36,16.36Z" fill="#d4af37" />
                      <path d="M10,10 L10,19 A9,9 0 0,1 3.64,16.36Z" fill="#d4af37" />
                      <path d="M10,10 L1,10 A9,9 0 0,1 3.64,3.64Z" fill="#d4af37" />
                      <path d="M10,10 L10,1 A9,9 0 0,1 16.36,3.64Z" fill="#d4af37" />
                      {/* Dots on gold wedges — symmetrically placed */}
                      <circle cx="16.9" cy="12.9" r="1.1" fill="#1a1a1a" />
                      <circle cx="7.1" cy="16.9" r="1.1" fill="#1a1a1a" />
                      <circle cx="3.1" cy="7.1" r="1.1" fill="#1a1a1a" />
                      <circle cx="12.9" cy="3.1" r="1.1" fill="#1a1a1a" />
                      {/* Gold outer ring */}
                      <circle cx="10" cy="10" r="8.7" fill="none" stroke="#b8941f" strokeWidth="0.6" />
                      {/* Black inner circle */}
                      <circle cx="10" cy="10" r="5.8" fill="#1a1a1a" stroke="#d4af37" strokeWidth="0.4" />
                      {/* Gold center */}
                      <circle cx="10" cy="10" r="4.8" fill="#d4af37" />
                      {/* Highlight for 3D feel */}
                      <ellipse cx="9" cy="8.5" rx="3" ry="2.5" fill="rgba(255,255,255,0.15)" />
                      {/* Center ring detail */}
                      <circle cx="10" cy="10" r="4.8" fill="none" stroke="#b8941f" strokeWidth="0.3" />
                    </svg>
                  </span>
                )}

                {/* Player name */}
                <span
                  className={cn(
                    'font-medium overflow-hidden text-ellipsis whitespace-nowrap min-w-0',
                    isFourPlayer ? 'text-[11px] sm:text-sm' : 'text-sm',
                    isMe ? 'text-gold-400' : 'text-white'
                  )}
                  title={player.name}
                >
                  {player.name}
                </span>

                {/* Bid indicator */}
                {isBidder && finalBid && (
                  <span className="px-1.5 py-0.5 text-xs bg-gold-500/20 text-gold-400 rounded">
                    {finalBid}
                  </span>
                )}
              </div>

              {/* Score */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {score?.isOnBarrel && (
                  <motion.span
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-xs text-amber-400 flex items-center gap-1"
                    aria-label="On the barrel (800+)"
                  >
                    <BarrelIcon className="w-5 h-5" />
                    <span className="sr-only">On barrel</span>
                  </motion.span>
                )}
                {score?.totalScore === 410 && (
                  <motion.span
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-xs text-emerald-400 flex items-center gap-1"
                    aria-label="Grunwald (410 points)"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      {/* Left tower */}
                      <rect x="1" y="4" width="3.5" height="12" fill="#1a1a1a" stroke="#d4af37" strokeWidth="0.6" />
                      <polygon points="1,4 2.75,1 4.5,4" fill="#1a1a1a" stroke="#d4af37" strokeWidth="0.6" />
                      <line x1="2.75" y1="0.5" x2="2.75" y2="-0.5" stroke="#d4af37" strokeWidth="0.5" />
                      <rect x="2.2" y="-0.5" width="1.1" height="0.8" fill="#d4af37" rx="0.2" />
                      <rect x="2" y="6" width="0.8" height="0.8" fill="#d4af37" opacity="0.5" />
                      <rect x="2" y="9" width="0.8" height="0.8" fill="#d4af37" opacity="0.5" />
                      {/* Right tower */}
                      <rect x="11.5" y="4" width="3.5" height="12" fill="#1a1a1a" stroke="#d4af37" strokeWidth="0.6" />
                      <polygon points="11.5,4 13.25,1 15,4" fill="#1a1a1a" stroke="#d4af37" strokeWidth="0.6" />
                      <line x1="13.25" y1="0.5" x2="13.25" y2="-0.5" stroke="#d4af37" strokeWidth="0.5" />
                      <rect x="12.7" y="-0.5" width="1.1" height="0.8" fill="#d4af37" rx="0.2" />
                      <rect x="13.2" y="6" width="0.8" height="0.8" fill="#d4af37" opacity="0.5" />
                      <rect x="13.2" y="9" width="0.8" height="0.8" fill="#d4af37" opacity="0.5" />
                      {/* Center wall */}
                      <rect x="4.5" y="6" width="7" height="10" fill="#1a1a1a" stroke="#d4af37" strokeWidth="0.6" />
                      {/* Crenellations */}
                      <rect x="5" y="4.5" width="1.5" height="1.5" fill="#1a1a1a" stroke="#d4af37" strokeWidth="0.5" />
                      <rect x="7.25" y="4.5" width="1.5" height="1.5" fill="#1a1a1a" stroke="#d4af37" strokeWidth="0.5" />
                      <rect x="9.5" y="4.5" width="1.5" height="1.5" fill="#1a1a1a" stroke="#d4af37" strokeWidth="0.5" />
                      {/* Gate arch */}
                      <path d="M6.5 16 V12 Q6.5 9.5 8 9.5 Q9.5 9.5 9.5 12 V16" fill="#d4af37" stroke="#b8941f" strokeWidth="0.4" />
                      {/* 3D highlight */}
                      <rect x="4.8" y="6.2" width="3" height="0.4" fill="rgba(255,255,255,0.1)" rx="0.2" />
                    </svg>
                    <span className="sr-only">Grunwald</span>
                  </motion.span>
                )}
                <span
                  className={cn(
                    'font-mono font-bold',
                    score?.totalScore >= 800
                      ? 'text-amber-400'
                      : score?.totalScore < 0
                      ? 'text-red-400'
                      : 'text-white'
                  )}
                >
                  {score?.totalScore ?? 0}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Round info */}
      {roundNumber && (
        <div className={cn(
          "border-t border-white/[0.08] flex items-center justify-center gap-2 text-xs text-white/60",
          isFourPlayer ? "mt-1.5 pt-1" : "mt-3 pt-2"
        )}>
          <span>Round {roundNumber}</span>
          {phase === 'trickPlaying' && completedTricks !== undefined && (
            <>
              <span className="text-white/30">•</span>
              <span>Trick {completedTricks + 1}/8</span>
            </>
          )}
        </div>
      )}
    </div>
  );
});

// Compact inline score display
interface InlineScoreProps {
  score: number;
  isOnBarrel?: boolean;
  className?: string;
}

export function InlineScore({ score, isOnBarrel, className }: InlineScoreProps) {
  return (
    <span
      className={cn(
        'font-mono font-medium',
        score >= 800
          ? 'text-amber-400'
          : score < 0
          ? 'text-red-400'
          : 'text-gold-400',
        className
      )}
    >
      {score}
      {isOnBarrel && (
        <span aria-label="on barrel" className="inline-flex items-center ml-1 text-amber-400">
          <BarrelIcon className="w-3 h-3" />
        </span>
      )}
    </span>
  );
}

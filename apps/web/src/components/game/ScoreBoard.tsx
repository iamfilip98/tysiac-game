'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getSuitSymbol, getSuitName } from '@tysiac/shared';
import type { Suit } from '@tysiac/shared';

function BarrelIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      {/* Barrel body — curved sides */}
      <path
        d="M6.5 4.5 Q4.5 10 6.5 15.5 L13.5 15.5 Q15.5 10 13.5 4.5 Z"
        fill="#8B5E3C"
      />
      {/* Top ellipse */}
      <ellipse cx="10" cy="4.5" rx="3.5" ry="1.8" fill="#A0713C" />
      {/* Top ellipse rim */}
      <ellipse cx="10" cy="4.5" rx="3.5" ry="1.8" fill="none" stroke="#d4af37" strokeWidth="0.5" />
      {/* Bottom ellipse (partial, visible rim) */}
      <ellipse cx="10" cy="15.5" rx="3.5" ry="1.5" fill="#6B4226" />
      <ellipse cx="10" cy="15.5" rx="3.5" ry="1.5" fill="none" stroke="#d4af37" strokeWidth="0.4" />
      {/* Gold bands */}
      <line x1="5.8" y1="7" x2="14.2" y2="7" stroke="#d4af37" strokeWidth="0.7" strokeLinecap="round" />
      <line x1="5.2" y1="10" x2="14.8" y2="10" stroke="#d4af37" strokeWidth="0.7" strokeLinecap="round" />
      <line x1="5.8" y1="13" x2="14.2" y2="13" stroke="#d4af37" strokeWidth="0.7" strokeLinecap="round" />
      {/* Subtle wood grain lines */}
      <line x1="8" y1="5.5" x2="7.6" y2="14.5" stroke="#6B4226" strokeWidth="0.3" opacity="0.5" />
      <line x1="10" y1="5" x2="10" y2="15" stroke="#6B4226" strokeWidth="0.3" opacity="0.5" />
      <line x1="12" y1="5.5" x2="12.4" y2="14.5" stroke="#6B4226" strokeWidth="0.3" opacity="0.5" />
      {/* Highlight for 3D feel */}
      <ellipse cx="8.5" cy="8" rx="2" ry="3.5" fill="rgba(255,255,255,0.1)" />
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
    )} style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 12px rgba(0,0,0,0.3)' }}>
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between border-b border-white/[0.08]",
        isFourPlayer ? "mb-1.5 pb-1" : "mb-3 pb-2"
      )}>
        <h3 className="text-[13px] font-semibold text-white/90 tracking-wide" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>Scores</h3>
        {trumpSuit && (
          <div className="flex items-center gap-1 text-sm">
            <span className="text-white/60 text-xs tracking-wide">Trump:</span>
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
                    isFourPlayer ? 'text-[11px] sm:text-[13px]' : 'text-[13px]',
                    isMe ? 'text-gold-400' : 'text-white/95'
                  )}
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                  title={player.name}
                >
                  {player.name}
                </span>

                {/* Bid indicator */}
                {isBidder && finalBid && (
                  <span className="px-1.5 py-0.5 text-xs font-medium bg-gold-500/20 text-gold-400 rounded" style={{ textShadow: '0 0 6px rgba(251,191,36,0.3)' }}>
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
                    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      {/* Black base */}
                      <circle cx="10" cy="10" r="9" fill="#1a1a1a" />
                      {/* Gold alternating wedges */}
                      <path d="M10,10 L19,10 A9,9 0 0,1 16.36,16.36Z" fill="#d4af37" />
                      <path d="M10,10 L10,19 A9,9 0 0,1 3.64,16.36Z" fill="#d4af37" />
                      <path d="M10,10 L1,10 A9,9 0 0,1 3.64,3.64Z" fill="#d4af37" />
                      <path d="M10,10 L10,1 A9,9 0 0,1 16.36,3.64Z" fill="#d4af37" />
                      {/* Dots on gold wedges */}
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
                      {/* Castle silhouette */}
                      <rect x="6.8" y="7.5" width="2.4" height="6" fill="#1a1a1a" />
                      <rect x="10.8" y="7.5" width="2.4" height="6" fill="#1a1a1a" />
                      <rect x="9.2" y="9" width="1.6" height="4.5" fill="#1a1a1a" />
                      {/* Battlements */}
                      <rect x="6.8" y="6.5" width="0.9" height="1" fill="#1a1a1a" />
                      <rect x="8.3" y="6.5" width="0.9" height="1" fill="#1a1a1a" />
                      <rect x="10.8" y="6.5" width="0.9" height="1" fill="#1a1a1a" />
                      <rect x="12.3" y="6.5" width="0.9" height="1" fill="#1a1a1a" />
                      {/* Gate arch */}
                      <path d="M9.3 13.5 V11.5 Q9.3 10.3 10 10.3 Q10.7 10.3 10.7 11.5 V13.5" fill="#d4af37" />
                      {/* Highlight for 3D feel */}
                      <ellipse cx="9" cy="8.5" rx="3" ry="2.5" fill="rgba(255,255,255,0.12)" />
                      {/* Center ring detail */}
                      <circle cx="10" cy="10" r="4.8" fill="none" stroke="#b8941f" strokeWidth="0.3" />
                    </svg>
                    <span className="sr-only">Grunwald</span>
                  </motion.span>
                )}
                <span
                  className={cn(
                    'font-mono font-bold text-[13px]',
                    score?.totalScore >= 800
                      ? 'text-amber-400'
                      : score?.totalScore < 0
                      ? 'text-red-400'
                      : 'text-white'
                  )}
                  style={{ textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
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
          "border-t border-white/[0.08] flex items-center justify-center gap-2 text-xs text-white/65 tracking-wide",
          isFourPlayer ? "mt-1.5 pt-1" : "mt-3 pt-2"
        )} style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
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

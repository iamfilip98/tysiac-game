'use client';

import { motion } from 'framer-motion';
import { cn, getSuitSymbol, getSuitName, truncateName } from '@/lib/utils';
import type { Suit } from '@tysiac/shared';

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

export function ScoreBoard({
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
      "bg-gradient-to-b from-table-800/90 to-table-900/90 backdrop-blur-md border border-white/[0.08] rounded-xl w-[220px]",
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
              className={cn(
                'text-base w-4 text-center',
                trumpSuit === 'hearts' || trumpSuit === 'diamonds'
                  ? 'text-red-500'
                  : 'text-white'
              )}
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
              <div className="flex items-center gap-2">
                {/* Dealer indicator */}
                {isDealer && (
                  <span
                    className="w-5 h-5 flex items-center justify-center"
                    title="Dealer"
                    aria-label="Dealer"
                    style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <defs>
                        <radialGradient id="chip-dome" cx="0.4" cy="0.35" r="0.65">
                          <stop offset="0%" stopColor="#f5e7a3" />
                          <stop offset="50%" stopColor="#d4af37" />
                          <stop offset="100%" stopColor="#9a7b1a" />
                        </radialGradient>
                        <radialGradient id="chip-shine" cx="0.4" cy="0.3" r="0.5">
                          <stop offset="0%" stopColor="rgba(255,255,255,0.45)" />
                          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                        </radialGradient>
                        <clipPath id="chip-clip">
                          <circle cx="10" cy="10" r="9" />
                        </clipPath>
                      </defs>
                      {/* Base chip */}
                      <circle cx="10" cy="10" r="9" fill="url(#chip-dome)" />
                      {/* Edge notches — 8 rectangles at 45° intervals, clipped to circle */}
                      <g clipPath="url(#chip-clip)">
                        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
                          <rect
                            key={angle}
                            x="9" y="0" width="2" height="3.5"
                            rx="0.5"
                            fill="#b8941f"
                            transform={`rotate(${angle} 10 10)`}
                          />
                        ))}
                      </g>
                      {/* Outer ring */}
                      <circle cx="10" cy="10" r="8.3" fill="none" stroke="#9a7b1a" strokeWidth="0.5" />
                      {/* Dotted decorative ring */}
                      <circle cx="10" cy="10" r="6.8" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" strokeDasharray="1.8 1.4" />
                      {/* Inner solid ring */}
                      <circle cx="10" cy="10" r="5.5" fill="none" stroke="#b8941f" strokeWidth="0.4" />
                      {/* Center star */}
                      <path
                        d="M10 5.8 L10.7 8.2 L13.2 8.2 L11.2 9.6 L11.9 12 L10 10.6 L8.1 12 L8.8 9.6 L6.8 8.2 L9.3 8.2 Z"
                        fill="rgba(255,255,255,0.85)"
                        stroke="#b8941f"
                        strokeWidth="0.3"
                      />
                      {/* Highlight overlay for shininess */}
                      <circle cx="10" cy="10" r="8.8" fill="url(#chip-shine)" />
                    </svg>
                  </span>
                )}

                {/* Player name */}
                <span
                  className={cn(
                    'text-sm font-medium',
                    isMe ? 'text-gold-400' : 'text-white'
                  )}
                  title={player.name}
                >
                  {truncateName(player.name)}
                </span>

                {/* Bid indicator */}
                {isBidder && finalBid && (
                  <span className="px-1.5 py-0.5 text-xs bg-gold-500/20 text-gold-400 rounded">
                    {finalBid}
                  </span>
                )}
              </div>

              {/* Score */}
              <div className="flex items-center gap-2">
                {score?.isOnBarrel && (
                  <motion.span
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-xs text-amber-400 flex items-center gap-1"
                    aria-label="On the barrel (800+)"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                      <rect x="3" y="2" width="10" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      <line x1="3" y1="6" x2="13" y2="6" stroke="currentColor" strokeWidth="1" />
                      <line x1="3" y1="10" x2="13" y2="10" stroke="currentColor" strokeWidth="1" />
                      <ellipse cx="8" cy="2" rx="5" ry="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      <ellipse cx="8" cy="14" rx="5" ry="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
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
                    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                      {/* Left tower */}
                      <rect x="1" y="5" width="4" height="11" fill="currentColor" opacity="0.15" stroke="currentColor" />
                      <rect x="1" y="3.5" width="1" height="1.5" fill="currentColor" />
                      <rect x="4" y="3.5" width="1" height="1.5" fill="currentColor" />
                      {/* Right tower */}
                      <rect x="11" y="5" width="4" height="11" fill="currentColor" opacity="0.15" stroke="currentColor" />
                      <rect x="11" y="3.5" width="1" height="1.5" fill="currentColor" />
                      <rect x="14" y="3.5" width="1" height="1.5" fill="currentColor" />
                      {/* Center wall + battlements */}
                      <rect x="5" y="7" width="6" height="9" fill="currentColor" opacity="0.1" stroke="currentColor" />
                      <rect x="5" y="5.5" width="1.5" height="1.5" fill="currentColor" />
                      <rect x="7.25" y="5.5" width="1.5" height="1.5" fill="currentColor" />
                      <rect x="9.5" y="5.5" width="1.5" height="1.5" fill="currentColor" />
                      {/* Gate arch */}
                      <path d="M6.5 16 V12 Q6.5 10 8 10 Q9.5 10 9.5 12 V16" fill="currentColor" opacity="0.3" stroke="currentColor" />
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
}

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
          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <rect x="3" y="2" width="10" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <line x1="3" y1="6" x2="13" y2="6" stroke="currentColor" strokeWidth="1" />
            <line x1="3" y1="10" x2="13" y2="10" stroke="currentColor" strokeWidth="1" />
            <ellipse cx="8" cy="2" rx="5" ry="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <ellipse cx="8" cy="14" rx="5" ry="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </span>
      )}
    </span>
  );
}

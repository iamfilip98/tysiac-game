'use client';

import { memo } from 'react';

import { cn } from '@/lib/utils';
import { getSuitSymbol, getSuitName } from '@tysiac/shared';
import type { Suit } from '@tysiac/shared';

function BarrelIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <defs>
        <clipPath id="barrel-clip">
          <path d="M5.5 4 Q3 10 5.5 16 L14.5 16 Q17 10 14.5 4 Z" />
        </clipPath>
      </defs>
      {/* Barrel body */}
      <path d="M5.5 4 Q3 10 5.5 16 L14.5 16 Q17 10 14.5 4 Z" fill="#1a1a1a" />
      {/* Top rim */}
      <ellipse cx="10" cy="4" rx="4.5" ry="2.2" fill="#222" stroke="#d4af37" strokeWidth="0.9" />
      <ellipse cx="10" cy="4.2" rx="3" ry="1.2" fill="#111" stroke="#b8941f" strokeWidth="0.4" />
      {/* Gold bands clipped to barrel shape */}
      <g clipPath="url(#barrel-clip)">
        <rect x="2" y="7" width="16" height="1.6" rx="0.3" fill="#d4af37" />
        <rect x="2" y="11.4" width="16" height="1.6" rx="0.3" fill="#d4af37" />
      </g>
      {/* Diamond ornaments on bands */}
      <polygon points="10,6.8 11,7.8 10,8.8 9,7.8" fill="#1a1a1a" stroke="#b8941f" strokeWidth="0.3" />
      <polygon points="10,11.2 11,12.2 10,13.2 9,12.2" fill="#1a1a1a" stroke="#b8941f" strokeWidth="0.3" />
      {/* Bottom rim */}
      <ellipse cx="10" cy="16" rx="4.5" ry="1.2" fill="none" stroke="#d4af37" strokeWidth="0.5" />
      {/* Barrel outline */}
      <path d="M5.5 4 Q3 10 5.5 16 L14.5 16 Q17 10 14.5 4 Z" fill="none" stroke="#d4af37" strokeWidth="0.7" />
      {/* Highlight */}
      <ellipse cx="7.5" cy="9.5" rx="2" ry="4" fill="rgba(255,255,255,0.07)" />
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
        <div className="flex items-center gap-1 text-sm min-w-[60px] justify-end">
          {trumpSuit ? (
            <>
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
            </>
          ) : (
            <span className="text-white/30 text-xs">&nbsp;</span>
          )}
        </div>
      </div>

      {/* Players */}
      <div className={isFourPlayer ? "space-y-0.5" : "space-y-2"}>
        {players.map((player) => {
          const score = scores[player.id];
          const isMe = player.id === currentPlayerId;
          const isBidder = bidWinner === player.id;
          const isDealer = dealerId === player.id;

          return (
            <div
              key={player.id}
              className={cn(
                'flex items-center justify-between rounded-lg',
                isFourPlayer ? 'p-1 px-1.5' : 'p-2',
                isMe && 'bg-gold-500/10 ring-1 ring-gold-500/30',
                isBidder && !isMe && 'bg-white/5'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                {/* Dealer indicator — fixed slot to prevent layout shift */}
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

              {/* Score — fixed width to prevent layout shift */}
              <div className="flex items-center gap-1.5 flex-shrink-0 justify-end min-w-[60px]">
                {score?.isOnBarrel && (
                  <span
                    className="text-xs text-amber-400 flex items-center gap-1"
                    aria-label="On the barrel (800+)"
                  >
                    <BarrelIcon className="w-5 h-5" />
                    <span className="sr-only">On barrel</span>
                  </span>
                )}
                {score?.totalScore === 410 && (
                  <span
                    className="text-xs text-amber-400 flex items-center gap-1"
                    aria-label="Grunwald (410 points)"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      {/* Left sword */}
                      <line x1="3" y1="17" x2="17" y2="3" stroke="#d4af37" strokeWidth="1.2" strokeLinecap="round" />
                      <line x1="3.5" y1="16.2" x2="16.2" y2="3.5" stroke="#f5e6a3" strokeWidth="0.4" strokeLinecap="round" />
                      <line x1="5" y1="12" x2="8.5" y2="15.5" stroke="#d4af37" strokeWidth="1.5" strokeLinecap="round" />
                      <circle cx="2.5" cy="17.5" r="1" fill="#d4af37" />
                      {/* Right sword */}
                      <line x1="17" y1="17" x2="3" y2="3" stroke="#d4af37" strokeWidth="1.2" strokeLinecap="round" />
                      <line x1="16.2" y1="16.2" x2="3.5" y2="3.5" stroke="#f5e6a3" strokeWidth="0.4" strokeLinecap="round" />
                      <line x1="15" y1="12" x2="11.5" y2="15.5" stroke="#d4af37" strokeWidth="1.5" strokeLinecap="round" />
                      <circle cx="17.5" cy="17.5" r="1" fill="#d4af37" />
                      {/* Center accent */}
                      <circle cx="10" cy="10" r="1.2" fill="#b8941f" stroke="#d4af37" strokeWidth="0.5" />
                    </svg>
                    <span className="sr-only">Grunwald</span>
                  </span>
                )}
                <span
                  className={cn(
                    'font-mono font-bold text-[13px] text-right min-w-[36px]',
                    score?.totalScore >= 800
                      ? 'text-amber-400'
                      : score?.totalScore < 0
                      ? 'text-card-red'
                      : 'text-white'
                  )}
                  style={{ textShadow: '0 1px 3px rgba(0,0,0,0.4)', fontVariantNumeric: 'tabular-nums' }}
                >
                  {score?.totalScore ?? 0}
                </span>
              </div>
            </div>
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
          ? 'text-card-red'
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

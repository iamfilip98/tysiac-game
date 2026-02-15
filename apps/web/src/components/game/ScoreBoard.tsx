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
                    className="text-sm"
                    role="img"
                    aria-label="Dealer"
                    title="Dealer"
                  >
                    🎱
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
                    role="img"
                    aria-label="On the barrel (800+)"
                  >
                    <span aria-hidden="true">🛢️</span>
                    <span className="sr-only">On barrel</span>
                  </motion.span>
                )}
                {score?.totalScore === 410 && (
                  <motion.span
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-xs text-emerald-400 flex items-center gap-1"
                    role="img"
                    aria-label="Grunwald (410 points)"
                  >
                    <span aria-hidden="true">🏰</span>
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
          : 'text-green-400',
        className
      )}
    >
      {score}
      {isOnBarrel && (
        <span role="img" aria-label="on barrel">
          {' '}
          <span aria-hidden="true">🛢️</span>
        </span>
      )}
    </span>
  );
}

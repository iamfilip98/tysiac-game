'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { truncateName } from '@tysiac/shared';
import type { GameStatistics } from '@tysiac/shared';
import { AwardCard } from './AwardCard';
import { DetailedStatsPanel } from './DetailedStatsPanel';
import { RoundHistoryGraph } from './RoundHistoryGraph';

function MedalIcon({ place }: { place: 0 | 1 | 2 }) {
  const colors = {
    0: { fill: '#d4af37', stroke: '#b8941f', ribbon: '#c41e3a' },
    1: { fill: '#b8bcc8', stroke: '#838791', ribbon: '#2563eb' },
    2: { fill: '#cd7f32', stroke: '#a0522d', ribbon: '#15803d' },
  };
  const c = colors[place];
  return (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 2 L12 8 L15 2" fill={c.ribbon} opacity="0.8" />
      <circle cx="12" cy="14" r="8" fill={c.fill} stroke={c.stroke} strokeWidth="1" />
      <circle cx="12" cy="14" r="5.5" fill="none" stroke={c.stroke} strokeWidth="0.6" />
      <text x="12" y="17.5" textAnchor="middle" fontSize="8" fontWeight="bold" fontFamily="serif" fill={c.stroke}>{place + 1}</text>
      <ellipse cx="10.5" cy="12" rx="3" ry="1.5" fill="rgba(255,255,255,0.15)" />
    </svg>
  );
}

interface GameEndModalProps {
  winnerId: string;
  players: { id: string; name: string }[];
  scores: Record<string, number>;
  currentPlayerId: string;
  statistics?: GameStatistics | null;
  onPlayAgain: () => void;
  onLeave: () => void;
}

type GameEndTab = 'awards' | 'stats' | 'history';

export function GameEndModal({
  winnerId,
  players,
  scores,
  currentPlayerId,
  statistics,
  onPlayAgain,
  onLeave,
}: GameEndModalProps) {
  const [activeTab, setActiveTab] = useState<GameEndTab>('awards');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to top when switching tabs
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [activeTab]);

  const winner = players.find((p) => p.id === winnerId);
  const isWinner = winnerId === currentPlayerId;

  const sortedPlayers = [...players].sort(
    (a, b) => (scores[b.id] || 0) - (scores[a.id] || 0)
  );

  // Helper to get player name by ID
  const getPlayerName = (playerId: string) => {
    return players.find((p) => p.id === playerId)?.name || 'Unknown';
  };

  const hasEnhancedStats = statistics?.playerDetails && statistics.playerDetails.length > 0;

  return (
    <Modal isOpen={true} className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col !p-0">
      {/* Hero header */}
      <div className="relative px-5 pt-5 pb-3 flex-shrink-0">
        {/* Subtle gradient glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-gold-500/10 via-transparent to-transparent pointer-events-none" />

        <div className="relative text-center">
          {/* Victory/defeat header */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 12 }}
            className="mb-3"
          >
            <div className="mb-1.5 flex justify-center">
              {isWinner ? (
                <motion.div
                  animate={{ rotate: [0, -5, 5, -3, 3, 0] }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  <svg className="w-10 h-10" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                    <path d="M10 8 L6 20 Q10 24 16 24 L18 18 Z" fill="#d4af37" stroke="#b8941f" strokeWidth="0.8" />
                    <path d="M38 8 L42 20 Q38 24 32 24 L30 18 Z" fill="#d4af37" stroke="#b8941f" strokeWidth="0.8" />
                    <path d="M16 24 L14 38 L34 38 L32 24 Q28 26 24 26 Q20 26 16 24 Z" fill="#d4af37" stroke="#b8941f" strokeWidth="0.8" />
                    <ellipse cx="24" cy="24" rx="10" ry="3" fill="#f5e7a3" opacity="0.4" />
                    <rect x="18" y="38" width="12" height="3" rx="0.5" fill="#b8941f" />
                    <rect x="15" y="41" width="18" height="3" rx="1" fill="#d4af37" stroke="#b8941f" strokeWidth="0.5" />
                    <path d="M20 28 L24 32 L28 28" fill="none" stroke="#b8941f" strokeWidth="1" />
                    <circle cx="24" cy="16" r="2" fill="#f5e7a3" opacity="0.6" />
                  </svg>
                </motion.div>
              ) : (
                <svg className="w-10 h-10" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                  <circle cx="24" cy="24" r="18" stroke="#d4af37" strokeWidth="1.5" fill="none" />
                  <circle cx="24" cy="24" r="13" stroke="#d4af37" strokeWidth="1" fill="none" />
                  <circle cx="24" cy="24" r="8" stroke="#d4af37" strokeWidth="0.8" fill="none" />
                  <circle cx="24" cy="24" r="3" fill="#d4af37" />
                  <line x1="24" y1="2" x2="24" y2="10" stroke="#d4af37" strokeWidth="1.5" />
                  <line x1="24" y1="38" x2="24" y2="46" stroke="#d4af37" strokeWidth="1.5" />
                  <line x1="2" y1="24" x2="10" y2="24" stroke="#d4af37" strokeWidth="1.5" />
                  <line x1="38" y1="24" x2="46" y2="24" stroke="#d4af37" strokeWidth="1.5" />
                </svg>
              )}
            </div>
            <h2 className={cn(
              'text-2xl font-extrabold',
              isWinner
                ? 'text-transparent bg-clip-text bg-gradient-to-r from-gold-300 via-gold-400 to-amber-500'
                : 'text-white'
            )}>
              {isWinner ? 'You Win!' : `${winner?.name} Wins!`}
            </h2>
          </motion.div>

          {/* Gold shimmer line */}
          <div className="h-px bg-gradient-to-r from-transparent via-gold-400/40 to-transparent mb-3" />

          {/* Compact standings */}
          <div className="space-y-1.5 mb-1">
            {sortedPlayers.map((player, index) => {
              const score = scores[player.id] || 0;
              const isMe = player.id === currentPlayerId;

              return (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, x: index === 0 ? 0 : index === 1 ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + index * 0.1, type: 'spring', damping: 20 }}
                  className={cn(
                    'flex items-center justify-between rounded-lg transition-colors',
                    index === 0
                      ? 'py-2 px-3 bg-gradient-to-r from-gold-500/15 to-gold-500/10 border border-gold-500/25'
                      : 'py-1.5 px-3 bg-white/[0.03]'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn('flex items-center', index === 0 ? 'w-6 h-6' : 'w-5 h-5')}>
                      <MedalIcon place={index as 0 | 1 | 2} />
                    </span>
                    <span
                      className={cn(
                        'font-semibold text-sm',
                        isMe ? 'text-gold-400' : 'text-white'
                      )}
                      title={player.name}
                    >
                      {truncateName(player.name)}
                      {isMe && (
                        <span className="text-gold-400/60 font-normal ml-1 text-xs">(You)</span>
                      )}
                    </span>
                  </div>
                  <span
                    className={cn(
                      'font-bold tabular-nums text-sm',
                      index === 0 ? 'text-gold-400' : 'text-white/80'
                    )}
                  >
                    {score}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Separator */}
      <div className="h-px bg-gradient-to-r from-transparent via-table-600 to-transparent mx-4 flex-shrink-0" />

      {/* Tabs — underlined text style */}
      {hasEnhancedStats && (
        <div className="flex mx-5 mt-2 mb-2 gap-4 flex-shrink-0">
          {(['awards', 'stats', 'history'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'pb-1.5 text-sm font-medium transition-all duration-200 border-b-2',
                activeTab === tab
                  ? 'border-gold-400 text-gold-400'
                  : 'border-transparent text-white/45 hover:text-white/70'
              )}
            >
              {tab === 'awards' ? 'Awards' : tab === 'stats' ? 'Stats' : 'History'}
            </button>
          ))}
        </div>
      )}

      {/* Tab content (scrollable) */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto mb-3 min-h-0 px-5">
        {/* Awards tab */}
        {activeTab === 'awards' && statistics && statistics.awards.length > 0 && (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {statistics.awards.map((award, index) => (
                <AwardCard
                  key={award.id}
                  award={award}
                  playerName={truncateName(getPlayerName(award.playerId))}
                  index={index}
                />
              ))}
            </div>
            {statistics.totalRounds > 0 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-xs text-white/50 mt-2.5 text-center"
              >
                Game completed in {statistics.totalRounds} round{statistics.totalRounds !== 1 ? 's' : ''}
                {statistics.victoryMargin > 0 && ` with a ${statistics.victoryMargin} point lead`}
              </motion.p>
            )}
          </div>
        )}

        {/* Stats tab */}
        {activeTab === 'stats' && statistics?.playerDetails && (
          <DetailedStatsPanel
            playerDetails={statistics.playerDetails}
            players={players}
            currentPlayerId={currentPlayerId}
          />
        )}

        {/* History tab */}
        {activeTab === 'history' && (
          <div>
            {statistics?.roundByRound && statistics.roundByRound.length > 1 && (
              <div>
                <h4 className="text-sm font-semibold text-white/70 mb-3">Score Progression</h4>
                <RoundHistoryGraph
                  roundByRound={statistics.roundByRound}
                  players={players}
                  currentPlayerId={currentPlayerId}
                />
              </div>
            )}
          </div>
        )}

        {/* Fallback if no enhanced stats */}
        {!hasEnhancedStats && statistics && statistics.awards.length > 0 && (
          <div>
            <motion.h3
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-base font-bold text-gold-400 mb-3 text-center"
            >
              Game Awards
            </motion.h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {statistics.awards.map((award, index) => (
                <AwardCard
                  key={award.id}
                  award={award}
                  playerName={truncateName(getPlayerName(award.playerId))}
                  index={index}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 flex-shrink-0 px-5 pb-4 pt-1">
        <Button variant="secondary" onClick={onLeave} className="flex-1">
          Leave Room
        </Button>
        <Button variant="primary" onClick={onPlayAgain} className="flex-1" glow>
          Play Again
        </Button>
      </div>
    </Modal>
  );
}

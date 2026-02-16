'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { cn, truncateName } from '@/lib/utils';
import type { GameStatistics } from '@tysiac/shared';
import { AwardCard } from './AwardCard';
import { DetailedStatsPanel } from './DetailedStatsPanel';
import { RoundHistoryGraph } from './RoundHistoryGraph';
import { WhatIfPanel } from './WhatIfPanel';

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
    <Modal isOpen={true} className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col !p-0">
      {/* Hero header with gradient background */}
      <div className="relative overflow-hidden px-6 pt-6 pb-4 flex-shrink-0">
        {/* Decorative radial glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-gold-500/10 via-transparent to-transparent pointer-events-none" />
        {isWinner && (
          <motion.div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-gold-400/15 blur-3xl pointer-events-none"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
          />
        )}

        <div className="relative text-center">
          {/* Victory/defeat header */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 10 }}
            className="mb-5"
          >
            {isWinner ? (
              <>
                <motion.div
                  className="mb-2 flex justify-center"
                  animate={{ rotate: [0, -5, 5, -3, 3, 0] }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  <svg className="w-16 h-16" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                    <path d="M10 8 L6 20 Q10 24 16 24 L18 18 Z" fill="#d4af37" stroke="#b8941f" strokeWidth="0.8" />
                    <path d="M38 8 L42 20 Q38 24 32 24 L30 18 Z" fill="#d4af37" stroke="#b8941f" strokeWidth="0.8" />
                    <path d="M16 24 L14 38 L34 38 L32 24 Q28 26 24 26 Q20 26 16 24 Z" fill="#d4af37" stroke="#b8941f" strokeWidth="0.8" />
                    <ellipse cx="24" cy="24" rx="10" ry="3" fill="#f5e7a3" opacity="0.4" />
                    <rect x="18" y="38" width="12" height="3" rx="0.5" fill="#b8941f" />
                    <rect x="15" y="41" width="18" height="3" rx="1" fill="#d4af37" stroke="#b8941f" strokeWidth="0.5" />
                    <path d="M20 28 L24 32 L28 28" fill="none" stroke="#b8941f" strokeWidth="1" />
                    <circle cx="24" cy="16" r="2" fill="#f5e7a3" opacity="0.6" />
                    <ellipse cx="22" cy="30" rx="4" ry="2" fill="rgba(255,255,255,0.12)" />
                  </svg>
                </motion.div>
                <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gold-300 via-gold-400 to-amber-500">
                  You Win!
                </h2>
              </>
            ) : (
              <>
                <div className="mb-2 flex justify-center">
                  <svg className="w-16 h-16" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                    <circle cx="24" cy="24" r="18" stroke="#d4af37" strokeWidth="1.5" fill="none" />
                    <circle cx="24" cy="24" r="13" stroke="#d4af37" strokeWidth="1" fill="none" />
                    <circle cx="24" cy="24" r="8" stroke="#d4af37" strokeWidth="0.8" fill="none" />
                    <circle cx="24" cy="24" r="3" fill="#d4af37" />
                    <line x1="24" y1="2" x2="24" y2="10" stroke="#d4af37" strokeWidth="1.5" />
                    <line x1="24" y1="38" x2="24" y2="46" stroke="#d4af37" strokeWidth="1.5" />
                    <line x1="2" y1="24" x2="10" y2="24" stroke="#d4af37" strokeWidth="1.5" />
                    <line x1="38" y1="24" x2="46" y2="24" stroke="#d4af37" strokeWidth="1.5" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white">
                  {winner?.name} Wins!
                </h2>
              </>
            )}
          </motion.div>

          {/* Final standings */}
          <div className="space-y-2 mb-2">
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
                    'flex items-center justify-between rounded-xl transition-colors',
                    index === 0
                      ? 'p-3 bg-gradient-to-r from-gold-500/20 via-amber-500/15 to-gold-500/20 border border-gold-500/30 shadow-sm shadow-gold-500/10'
                      : 'p-2.5 bg-white/5 border border-white/5'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={cn('flex items-center', index === 0 ? 'w-7 h-7' : 'w-6 h-6')}>
                      <MedalIcon place={index as 0 | 1 | 2} />
                    </span>
                    <span
                      className={cn(
                        'font-semibold',
                        index === 0 ? 'text-base' : 'text-sm',
                        isMe ? 'text-gold-400' : 'text-white'
                      )}
                      title={player.name}
                    >
                      {truncateName(player.name)}
                      {isMe && (
                        <span className="text-gold-400/60 font-normal ml-1">(You)</span>
                      )}
                    </span>
                  </div>
                  <span
                    className={cn(
                      'font-bold tabular-nums',
                      index === 0 ? 'text-lg text-gold-400' : 'text-base text-white/80'
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

      {/* Tabs */}
      {hasEnhancedStats && (
        <div className="flex mx-4 mt-3 mb-3 bg-white/5 rounded-lg p-1 flex-shrink-0">
          {(['awards', 'stats', 'history'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 py-1.5 text-sm font-medium rounded-md transition-all duration-200',
                activeTab === tab
                  ? 'bg-gold-500/20 text-gold-400 shadow-sm'
                  : 'text-white/50 hover:text-white/70'
              )}
            >
              {tab === 'awards' ? 'Awards' : tab === 'stats' ? 'Stats' : 'History'}
            </button>
          ))}
        </div>
      )}

      {/* Tab content (scrollable) */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto mb-4 min-h-0 px-5">
        {/* Awards tab */}
        {activeTab === 'awards' && statistics && statistics.awards.length > 0 && (
          <div>
            <div className="grid grid-cols-2 gap-3">
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
                className="text-sm text-white/50 mt-3 text-center"
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
          <div className="space-y-6">
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
            {statistics?.whatIf && statistics?.closeCalls && (
              <WhatIfPanel
                scenarios={statistics.whatIf}
                closeCalls={statistics.closeCalls}
              />
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
              className="text-lg font-bold text-gold-400 mb-4 text-center"
            >
              Game Awards
            </motion.h3>
            <div className="grid grid-cols-2 gap-3">
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
      <div className="flex gap-3 flex-shrink-0 px-5 pb-5 pt-2">
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

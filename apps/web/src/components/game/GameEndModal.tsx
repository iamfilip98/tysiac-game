'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { cn, truncateName } from '@/lib/utils';
import type { GameStatistics } from '@tysiac/shared';
import { AwardCard } from './AwardCard';
import { DetailedStatsPanel } from './DetailedStatsPanel';
import { RoundHistoryGraph } from './RoundHistoryGraph';
import { WhatIfPanel } from './WhatIfPanel';

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
    <Modal isOpen={true} className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
      <div className="text-center flex-shrink-0">
        {/* Victory/defeat header */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 10 }}
          className="mb-4"
        >
          {isWinner ? (
            <>
              <div className="text-5xl mb-2">🏆</div>
              <h2 className="text-2xl font-bold text-gold-400">You Win!</h2>
            </>
          ) : (
            <>
              <div className="text-5xl mb-2">🎯</div>
              <h2 className="text-xl font-bold text-white">
                {winner?.name} Wins!
              </h2>
            </>
          )}
        </motion.div>

        {/* Final standings (always visible) */}
        <div className="space-y-1.5 mb-4">
          {sortedPlayers.map((player, index) => {
            const score = scores[player.id] || 0;
            const isMe = player.id === currentPlayerId;

            return (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  'flex items-center justify-between p-2 rounded-lg',
                  index === 0
                    ? 'bg-gold-500/20 border border-gold-500/30'
                    : 'bg-table-800/50'
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                  </span>
                  <span
                    className={cn(
                      'font-medium text-sm',
                      isMe ? 'text-gold-400' : 'text-white'
                    )}
                    title={player.name}
                  >
                    {truncateName(player.name)}
                    {isMe && ' (You)'}
                  </span>
                </div>
                <span
                  className={cn(
                    'font-bold',
                    index === 0 ? 'text-gold-400' : 'text-white'
                  )}
                >
                  {score}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      {hasEnhancedStats && (
        <div className="flex border-b border-table-600 mb-4 flex-shrink-0">
          <button
            onClick={() => setActiveTab('awards')}
            className={cn(
              'flex-1 py-2 text-sm font-medium transition-colors',
              activeTab === 'awards'
                ? 'text-gold-400 border-b-2 border-gold-400'
                : 'text-white/50 hover:text-white/70'
            )}
          >
            Awards
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={cn(
              'flex-1 py-2 text-sm font-medium transition-colors',
              activeTab === 'stats'
                ? 'text-gold-400 border-b-2 border-gold-400'
                : 'text-white/50 hover:text-white/70'
            )}
          >
            Stats
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              'flex-1 py-2 text-sm font-medium transition-colors',
              activeTab === 'history'
                ? 'text-gold-400 border-b-2 border-gold-400'
                : 'text-white/50 hover:text-white/70'
            )}
          >
            History
          </button>
        </div>
      )}

      {/* Tab content (scrollable) */}
      <div className="flex-1 overflow-y-auto mb-4 min-h-0">
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
      <div className="flex gap-3 flex-shrink-0">
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

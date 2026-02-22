'use client';

import { motion } from 'framer-motion';
import type { DetailedPlayerStats } from '@tysiac/shared';

interface DetailedStatsPanelProps {
  playerDetails: DetailedPlayerStats[];
  players: { id: string; name: string }[];
  currentPlayerId: string;
}

export function DetailedStatsPanel({ playerDetails, players, currentPlayerId }: DetailedStatsPanelProps) {
  const getPlayerName = (playerId: string) => {
    return players.find(p => p.id === playerId)?.name || 'Unknown';
  };

  return (
    <div className="space-y-4">
      {playerDetails.map((detail, index) => {
        const isMe = detail.playerId === currentPlayerId;
        return (
          <motion.div
            key={detail.playerId}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`p-4 rounded-lg ${isMe ? 'bg-gold-500/10 border border-gold-500/30' : 'bg-table-800/50'}`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className={`font-bold ${isMe ? 'text-gold-400' : 'text-white'}`}>
                {getPlayerName(detail.playerId)}
                {isMe && ' (You)'}
              </span>
              <span className="text-xs text-white/50">
                Score range: {detail.lowestScore} - {detail.highestScore}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {/* Bid stats */}
              <div className="bg-table-900/50 rounded p-2 flex flex-col min-h-[60px]">
                <div className="text-white/50 text-xs mb-1">Bid Success Rate</div>
                <div className="flex items-center gap-2 mt-auto">
                  <div className="flex-1 h-2 bg-table-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${detail.bidSuccessRate}%` }}
                      transition={{ delay: 0.3, duration: 0.5 }}
                      className={`h-full ${detail.bidSuccessRate >= 50 ? 'bg-gold-500' : ''}`}
                      style={detail.bidSuccessRate < 50 ? { backgroundColor: 'var(--card-red)' } : undefined}
                    />
                  </div>
                  <span className={`font-mono ${detail.bidSuccessRate >= 50 ? 'text-gold-400' : 'text-card-red'}`}>
                    {detail.bidSuccessRate}%
                  </span>
                </div>
                <div className="text-white/40 text-xs mt-1">
                  {detail.totalBidsWon}W / {detail.totalBidsFailed}L
                </div>
              </div>

              {/* Avg bid */}
              <div className="bg-table-900/50 rounded p-2 flex flex-col min-h-[60px]">
                <div className="text-white/50 text-xs mb-1">Avg Bid Amount</div>
                <div className="text-lg font-bold text-gold-400 mt-auto">
                  {detail.avgBidAmount}
                </div>
              </div>

              {/* Marriages */}
              <div className="bg-table-900/50 rounded p-2 flex flex-col min-h-[60px]">
                <div className="text-white/50 text-xs mb-1">Marriages Declared</div>
                <div className="text-lg font-bold text-gold-400 mt-auto">
                  {detail.totalMarriages}
                </div>
              </div>

              {/* Best round */}
              <div className="bg-table-900/50 rounded p-2 flex flex-col min-h-[60px]">
                <div className="text-white/50 text-xs mb-1">Best Round</div>
                <div className="text-lg font-bold text-amber-400 mt-auto">
                  {detail.highestSingleRound > 0 ? `+${detail.highestSingleRound}` : '-'}
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

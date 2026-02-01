'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { RoundByRoundData } from '@tysiac/shared';

interface RoundHistoryGraphProps {
  roundByRound: RoundByRoundData[];
  players: { id: string; name: string }[];
  currentPlayerId: string;
}

// Color palette for players
const PLAYER_COLORS = ['#fbbf24', '#22c55e', '#3b82f6', '#f43f5e'];

export function RoundHistoryGraph({ roundByRound, players, currentPlayerId }: RoundHistoryGraphProps) {
  const { paths, yMin, yMax, width, height, padding } = useMemo(() => {
    const w = 300;
    const h = 150;
    const pad = { top: 20, right: 20, bottom: 30, left: 40 };

    // Find min/max scores
    let minScore = 0;
    let maxScore = 1000;
    for (const round of roundByRound) {
      for (const score of Object.values(round.scores)) {
        minScore = Math.min(minScore, score);
        maxScore = Math.max(maxScore, score);
      }
    }
    // Add some padding
    minScore = Math.floor(minScore / 100) * 100 - 50;
    maxScore = Math.ceil(maxScore / 100) * 100 + 50;

    const chartWidth = w - pad.left - pad.right;
    const chartHeight = h - pad.top - pad.bottom;

    // Generate paths for each player
    const playerPaths: Record<string, string> = {};

    for (const player of players) {
      const points: string[] = [];

      for (let i = 0; i < roundByRound.length; i++) {
        const round = roundByRound[i];
        const score = round.scores[player.id] ?? 0;

        const x = pad.left + (i / Math.max(1, roundByRound.length - 1)) * chartWidth;
        const y = pad.top + chartHeight - ((score - minScore) / (maxScore - minScore)) * chartHeight;

        points.push(`${x},${y}`);
      }

      playerPaths[player.id] = points.length > 0 ? `M ${points.join(' L ')}` : '';
    }

    return {
      paths: playerPaths,
      yMin: minScore,
      yMax: maxScore,
      width: w,
      height: h,
      padding: pad,
    };
  }, [roundByRound, players]);

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Y-axis labels
  const yLabels = useMemo(() => {
    const labels: number[] = [];
    for (let score = Math.ceil(yMin / 200) * 200; score <= yMax; score += 200) {
      labels.push(score);
    }
    return labels;
  }, [yMin, yMax]);

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        {/* Background */}
        <rect x={padding.left} y={padding.top} width={chartWidth} height={chartHeight} fill="#1a1a2e" rx="4" />

        {/* Grid lines */}
        {yLabels.map((score) => {
          const y = padding.top + chartHeight - ((score - yMin) / (yMax - yMin)) * chartHeight;
          return (
            <g key={score}>
              <line x1={padding.left} y1={y} x2={padding.left + chartWidth} y2={y} stroke="#333" strokeWidth="0.5" />
              <text x={padding.left - 5} y={y + 3} textAnchor="end" fill="#666" fontSize="8">
                {score}
              </text>
            </g>
          );
        })}

        {/* 1000 point line (winning) */}
        {1000 >= yMin && 1000 <= yMax && (
          <line
            x1={padding.left}
            y1={padding.top + chartHeight - ((1000 - yMin) / (yMax - yMin)) * chartHeight}
            x2={padding.left + chartWidth}
            y2={padding.top + chartHeight - ((1000 - yMin) / (yMax - yMin)) * chartHeight}
            stroke="#fbbf24"
            strokeWidth="1"
            strokeDasharray="4,4"
            opacity={0.5}
          />
        )}

        {/* Zero line */}
        {0 >= yMin && 0 <= yMax && (
          <line
            x1={padding.left}
            y1={padding.top + chartHeight - ((0 - yMin) / (yMax - yMin)) * chartHeight}
            x2={padding.left + chartWidth}
            y2={padding.top + chartHeight - ((0 - yMin) / (yMax - yMin)) * chartHeight}
            stroke="#666"
            strokeWidth="1"
          />
        )}

        {/* Player lines */}
        {players.map((player, index) => {
          const isMe = player.id === currentPlayerId;
          const color = isMe ? PLAYER_COLORS[0] : PLAYER_COLORS[(index % (PLAYER_COLORS.length - 1)) + 1];

          return (
            <motion.path
              key={player.id}
              d={paths[player.id]}
              fill="none"
              stroke={color}
              strokeWidth={isMe ? 2.5 : 1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1, delay: index * 0.2 }}
            />
          );
        })}

        {/* X-axis label */}
        <text x={width / 2} y={height - 5} textAnchor="middle" fill="#666" fontSize="8">
          Round
        </text>
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-3 mt-2">
        {players.map((player, index) => {
          const isMe = player.id === currentPlayerId;
          const color = isMe ? PLAYER_COLORS[0] : PLAYER_COLORS[(index % (PLAYER_COLORS.length - 1)) + 1];

          return (
            <div key={player.id} className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-0.5" style={{ backgroundColor: color }} />
              <span className={isMe ? 'text-gold-400' : 'text-white/70'}>
                {player.name.length > 8 ? player.name.slice(0, 8) + '…' : player.name}
                {isMe && ' (You)'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

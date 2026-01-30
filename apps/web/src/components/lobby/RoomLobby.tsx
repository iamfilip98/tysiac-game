'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { ElectricBorder } from '@/components/ui/ElectricBorder';
import { cn } from '@/lib/utils';
import type { Room, RoomPlayer } from '@tysiac/shared';

interface RoomLobbyProps {
  room: Room;
  currentPlayerId: string;
  onReady: (ready: boolean) => void;
  onAddAI: () => void;
  onRemoveAI: (aiId: string) => void;
  onStart: () => void;
  onLeave: () => void;
}

export function RoomLobby({
  room,
  currentPlayerId,
  onReady,
  onAddAI,
  onRemoveAI,
  onStart,
  onLeave,
}: RoomLobbyProps) {
  const [copied, setCopied] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isAddingAI, setIsAddingAI] = useState(false);

  const isHost = room.hostId === currentPlayerId;
  const currentPlayer = room.players.find((p) => p.id === currentPlayerId);
  const canStart =
    room.players.length === 3 &&
    room.players.filter((p) => !p.isAI).every((p) => p.isReady);
  const canAddAI = room.players.length < 3;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = room.code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStart = () => {
    setIsStarting(true);
    onStart();
    // Reset after timeout in case of failure
    setTimeout(() => setIsStarting(false), 5000);
  };

  const handleAddAI = () => {
    setIsAddingAI(true);
    onAddAI();
    setTimeout(() => setIsAddingAI(false), 1000);
  };

  return (
    <div className="max-w-lg mx-auto" role="region" aria-label="Room lobby">
      <ElectricBorder active color="#fbbf24">
        <div className="bg-table-900/90 backdrop-blur p-6 rounded-xl">
          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">{room.name}</h2>
            <div className="flex items-center justify-center gap-2">
              <span className="text-sm text-white/60">Room Code:</span>
              <span
                className="font-mono text-lg text-gold-400 tracking-widest bg-table-800 px-3 py-1 rounded"
                aria-label={`Room code: ${room.code.split('').join(' ')}`}
              >
                {room.code}
              </span>
              <button
                onClick={handleCopyCode}
                className="p-1 text-white/40 hover:text-white transition-colors rounded focus:outline-none focus:ring-2 focus:ring-gold-500"
                aria-label={copied ? 'Copied!' : 'Copy room code'}
              >
                {copied ? (
                  <svg
                    className="w-4 h-4 text-green-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                    />
                  </svg>
                )}
              </button>
            </div>
            {copied && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-sm text-green-400 mt-2"
                role="status"
              >
                Copied to clipboard!
              </motion.p>
            )}
          </div>

          {/* Players */}
          <div className="space-y-3 mb-6">
            <div className="text-sm text-white/60 mb-2" id="players-label">
              Players ({room.players.length}/3)
            </div>

            <ul aria-labelledby="players-label" className="space-y-3">
              {room.players.map((player) => (
                <li key={player.id}>
                  <PlayerSlot
                    player={player}
                    isCurrentPlayer={player.id === currentPlayerId}
                    isHost={player.isHost}
                    canRemove={isHost && player.isAI}
                    onRemove={() => onRemoveAI(player.id)}
                  />
                </li>
              ))}
            </ul>

            {/* Empty slots */}
            {Array.from({ length: 3 - room.players.length }).map((_, i) => (
              <motion.div
                key={`empty-${i}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-3 rounded-lg border-2 border-dashed border-table-600 text-center text-white/40"
                role="listitem"
                aria-label="Empty player slot"
              >
                Waiting for player...
              </motion.div>
            ))}
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {/* Ready toggle */}
            {!currentPlayer?.isAI && (
              <Button
                variant={currentPlayer?.isReady ? 'danger' : 'secondary'}
                onClick={() => onReady(!currentPlayer?.isReady)}
                className="w-full"
                aria-pressed={currentPlayer?.isReady}
              >
                {currentPlayer?.isReady ? 'Cancel Ready' : 'Ready Up'}
              </Button>
            )}

            {/* Host actions */}
            {isHost && (
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={handleAddAI}
                  disabled={!canAddAI || isAddingAI}
                  className="flex-1"
                  aria-busy={isAddingAI}
                >
                  {isAddingAI ? 'Adding...' : 'Add AI'}
                </Button>
                <Button
                  variant="primary"
                  onClick={handleStart}
                  disabled={!canStart || isStarting}
                  className="flex-1"
                  glow={canStart && !isStarting}
                  aria-busy={isStarting}
                >
                  {isStarting ? 'Starting...' : 'Start Game'}
                </Button>
              </div>
            )}

            {/* Leave button */}
            <Button variant="ghost" onClick={onLeave} className="w-full">
              Leave Room
            </Button>
          </div>

          {/* Start hint */}
          {isHost && !canStart && (
            <div className="mt-4 text-center text-sm text-white/40" role="status">
              {room.players.length < 3
                ? 'Need 3 players to start'
                : 'All players must be ready to start'}
            </div>
          )}
        </div>
      </ElectricBorder>
    </div>
  );
}

interface PlayerSlotProps {
  player: RoomPlayer;
  isCurrentPlayer: boolean;
  isHost: boolean;
  canRemove: boolean;
  onRemove: () => void;
}

function PlayerSlot({
  player,
  isCurrentPlayer,
  isHost,
  canRemove,
  onRemove,
}: PlayerSlotProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'flex items-center justify-between p-3 rounded-lg',
        isCurrentPlayer
          ? 'bg-gold-500/10 border border-gold-500/30'
          : 'bg-table-800/50 border border-table-600'
      )}
    >
      <div className="flex items-center gap-3">
        {/* Avatar placeholder */}
        <div
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center font-bold',
            player.isAI
              ? 'bg-purple-500/20 text-purple-400'
              : 'bg-table-700 text-white'
          )}
          aria-hidden="true"
        >
          {player.isAI ? '🤖' : player.name[0].toUpperCase()}
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'font-medium',
                isCurrentPlayer ? 'text-gold-400' : 'text-white'
              )}
            >
              {player.name}
            </span>
            {isHost && (
              <span className="text-xs bg-gold-500/20 text-gold-400 px-1.5 py-0.5 rounded">
                Host
              </span>
            )}
            {player.isAI && (
              <span className="text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">
                AI
              </span>
            )}
          </div>
          <div className="text-xs text-white/40">
            {isCurrentPlayer ? 'You' : player.isAI ? 'Computer' : 'Player'}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Ready status */}
        {player.isReady ? (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-green-400 text-sm flex items-center gap-1"
            role="status"
            aria-label={`${player.name} is ready`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Ready
          </motion.span>
        ) : (
          <span className="text-white/40 text-sm" aria-label={`${player.name} is not ready`}>
            Not ready
          </span>
        )}

        {/* Remove AI button */}
        {canRemove && (
          <button
            onClick={onRemove}
            className="p-1 text-red-400 hover:text-red-300 transition-colors rounded focus:outline-none focus:ring-2 focus:ring-red-500"
            aria-label={`Remove ${player.name}`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </motion.div>
  );
}

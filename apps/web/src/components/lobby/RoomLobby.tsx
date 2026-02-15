'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { ElectricBorder } from '@/components/ui/ElectricBorder';
import { cn, truncateName, copyToClipboard } from '@/lib/utils';
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

// Fixed height for player slots to prevent layout shifts
const SLOT_HEIGHT = 'h-[72px]';

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
  const [linkCopied, setLinkCopied] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isAddingAI, setIsAddingAI] = useState(false);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  const trackTimeout = (fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timeoutsRef.current.push(id);
    return id;
  };

  const isHost = room.hostId === currentPlayerId;
  const currentPlayer = room.players.find((p) => p.id === currentPlayerId);
  const canStart =
    room.players.length === room.maxPlayers &&
    room.players.filter((p) => !p.isAI).every((p) => p.isReady);
  const canAddAI = room.players.length < room.maxPlayers;

  const handleCopyCode = async () => {
    await copyToClipboard(room.code);
    setCopied(true);
    trackTimeout(() => setCopied(false), 2000);
  };

  const getShareUrl = () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/?room=${room.code}`;
  };

  const handleShare = async () => {
    const shareUrl = getShareUrl();
    const shareData = {
      title: 'Join my Tysiąc game!',
      text: `Join my room "${room.name}"`,
      url: shareUrl,
    };

    // Try Web Share API first (works on mobile)
    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // User cancelled or share failed, fall back to copy
        if ((err as Error).name === 'AbortError') return;
      }
    }

    // Fallback: copy link to clipboard
    await copyToClipboard(shareUrl);
    setLinkCopied(true);
    trackTimeout(() => setLinkCopied(false), 2000);
  };

  const handleStart = () => {
    if (!canStart || isStarting) return;
    setIsStarting(true);
    onStart();
    trackTimeout(() => setIsStarting(false), 5000);
  };

  const handleAddAI = () => {
    if (!canAddAI || isAddingAI) return;
    setIsAddingAI(true);
    onAddAI();
    trackTimeout(() => setIsAddingAI(false), 1000);
  };

  // Build the slot array: filled slots + empty slots
  const slots = [
    ...room.players,
    ...Array(room.maxPlayers - room.players.length).fill(null),
  ];

  return (
    <div className="w-full max-w-lg mx-auto" role="region" aria-label="Room lobby">
      <ElectricBorder active color="#fbbf24">
        <div className="bg-gradient-to-b from-table-800/90 to-table-900/90 backdrop-blur-md p-6 rounded-xl" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}>
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
              <button
                onClick={handleShare}
                className="p-1 text-white/40 hover:text-white transition-colors rounded focus:outline-none focus:ring-2 focus:ring-gold-500"
                aria-label={linkCopied ? 'Link copied!' : 'Share invite link'}
              >
                {linkCopied ? (
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
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                    />
                  </svg>
                )}
              </button>
            </div>
            {/* Reserve space for copy confirmation to prevent layout shift */}
            <p
              className={cn(
                'text-sm text-green-400 mt-2 min-h-[20px] transition-opacity',
                copied || linkCopied ? 'opacity-100' : 'opacity-0'
              )}
              role="status"
              aria-hidden={!copied && !linkCopied}
            >
              {linkCopied ? 'Link copied to clipboard!' : 'Code copied to clipboard!'}
            </p>
          </div>

          {/* Players - Fixed height container */}
          <div className="mb-6">
            <div className="text-sm text-white/60 mb-2" id="players-label">
              Players ({room.players.length}/{room.maxPlayers})
              {room.maxPlayers === 4 && (
                <span className="ml-2 text-xs text-white/40">(dealer sits out each round)</span>
              )}
            </div>

            <div className="space-y-3" aria-labelledby="players-label">
              {slots.map((slot, index) =>
                slot ? (
                  <PlayerSlot
                    key={slot.id}
                    player={slot}
                    isCurrentPlayer={slot.id === currentPlayerId}
                    isHost={slot.isHost}
                    canRemove={isHost && slot.isAI}
                    onRemove={() => onRemoveAI(slot.id)}
                  />
                ) : (
                  <EmptySlot
                    key={`empty-${index}`}
                    isHost={isHost}
                    canAddAI={canAddAI}
                    isAddingAI={isAddingAI}
                    onAddAI={handleAddAI}
                  />
                )
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {/* Ready toggle - only for non-AI players */}
            {!currentPlayer?.isAI && (
              <Button
                variant={currentPlayer?.isReady ? 'danger' : 'secondary'}
                onClick={() => onReady(!currentPlayer?.isReady)}
                className="w-full py-3 whitespace-nowrap"
                aria-pressed={currentPlayer?.isReady}
              >
                {currentPlayer?.isReady ? 'Cancel Ready' : 'Ready Up'}
              </Button>
            )}

            {/* Host actions - Start Game is now a separate prominent button */}
            {isHost && (
              <div className="mt-4 pt-4 border-t border-white/[0.08]">
                <Button
                  variant="primary"
                  onClick={handleStart}
                  disabled={!canStart || isStarting}
                  className={cn(
                    'w-full py-4 text-lg font-bold',
                    !canStart && 'opacity-50 cursor-not-allowed'
                  )}
                  glow={canStart && !isStarting}
                  aria-busy={isStarting}
                  aria-disabled={!canStart}
                >
                  {isStarting ? 'Starting Game...' : 'Start Game'}
                </Button>
              </div>
            )}

            {/* Leave button */}
            <Button variant="ghost" onClick={onLeave} className="w-full">
              Leave Room
            </Button>
          </div>

          {/* Start hint - show requirements (always reserve space to prevent layout shift) */}
          {isHost && (
            <div
              className={cn(
                'mt-4 text-center text-sm text-white/40 min-h-[20px]',
                canStart && 'invisible'
              )}
              role="status"
              aria-hidden={canStart}
            >
              {room.players.length < room.maxPlayers
                ? `Need ${room.maxPlayers - room.players.length} more player${room.maxPlayers - room.players.length > 1 ? 's' : ''} to start`
                : 'You must click "Ready Up" before starting'}
            </div>
          )}
        </div>
      </ElectricBorder>
    </div>
  );
}

// Empty slot component with fixed height matching PlayerSlot
interface EmptySlotProps {
  isHost: boolean;
  canAddAI: boolean;
  isAddingAI: boolean;
  onAddAI: () => void;
}

function EmptySlot({ isHost, canAddAI, isAddingAI, onAddAI }: EmptySlotProps) {
  return (
    <div
      className={cn(
        SLOT_HEIGHT,
        'flex items-center justify-center',
        'rounded-lg border-2 border-dashed border-white/[0.12] text-white/40'
      )}
      role="listitem"
      aria-label="Empty player slot"
    >
      {isHost && canAddAI ? (
        <button
          onClick={onAddAI}
          disabled={isAddingAI}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
            'bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 hover:text-purple-300',
            'border border-purple-500/30 hover:border-purple-500/50',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          aria-busy={isAddingAI}
        >
          <span className="text-lg">🤖</span>
          {isAddingAI ? 'Adding...' : 'Add AI'}
        </button>
      ) : (
        'Waiting for player...'
      )}
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
        SLOT_HEIGHT,
        'flex items-center justify-between px-3 rounded-lg',
        isCurrentPlayer
          ? 'bg-gold-500/10 border border-gold-500/30'
          : 'bg-table-800/50 border border-white/[0.08]'
      )}
      role="listitem"
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0',
            player.isAI
              ? 'bg-purple-500/20 text-purple-400'
              : 'bg-table-700 text-white'
          )}
          aria-hidden="true"
        >
          {player.isAI ? '🤖' : player.name[0].toUpperCase()}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                'font-medium',
                isCurrentPlayer ? 'text-gold-400' : 'text-white'
              )}
              title={player.name}
            >
              {truncateName(player.name)}
            </span>
            {isHost && (
              <span className="text-xs bg-gold-500/20 text-gold-400 px-1.5 py-0.5 rounded shrink-0">
                Host
              </span>
            )}
            {player.isAI && (
              <span className="text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded shrink-0">
                AI
              </span>
            )}
          </div>
          <div className="text-xs text-white/40">
            {isCurrentPlayer ? 'You' : player.isAI ? 'Computer' : 'Player'}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Ready status - fixed width to prevent layout shift */}
        <span
          className={cn(
            'text-sm flex items-center gap-1 w-[75px] justify-end',
            player.isReady ? 'text-green-400' : 'text-white/40'
          )}
          role="status"
          aria-label={`${player.name} is ${player.isReady ? 'ready' : 'not ready'}`}
        >
          {player.isReady && (
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
          )}
          {player.isReady ? 'Ready' : 'Not ready'}
        </span>

        {/* Remove AI button */}
        {canRemove && (
          <button
            onClick={onRemove}
            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors rounded focus:outline-none focus:ring-2 focus:ring-red-500"
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

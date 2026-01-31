'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { CreateRoomForm } from '@/components/lobby/CreateRoomForm';
import { JoinRoomForm } from '@/components/lobby/JoinRoomForm';
import { RoomLobby } from '@/components/lobby/RoomLobby';
import { GameBoard } from '@/components/game/GameBoard';
import { useSocket } from '@/hooks/useSocket';
import { useRoomStore } from '@/stores/roomStore';
import { useGameStore } from '@/stores/gameStore';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';

export default function HomePage() {
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const { showToast } = useToast();
  const previousError = useRef<string | null>(null);

  const { room, playerId, isConnected, isConnecting, error } = useRoomStore();

  // Show toast when error changes
  useEffect(() => {
    if (error && error !== previousError.current) {
      showToast(error, 'error');
      previousError.current = error;
    } else if (!error) {
      previousError.current = null;
    }
  }, [error, showToast]);
  const { gameState } = useGameStore();

  const {
    createRoom,
    joinRoom,
    leaveRoom,
    setReady,
    addAI,
    removeAI,
    startGame,
  } = useSocket();

  // If there's an active game, show the game board
  if (gameState && room?.gameId) {
    return <GameBoard />;
  }

  // If in a room, show the lobby
  if (room && playerId) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <RoomLobby
          room={room}
          currentPlayerId={playerId}
          onReady={setReady}
          onAddAI={addAI}
          onRemoveAI={removeAI}
          onStart={startGame}
          onLeave={leaveRoom}
        />
      </main>
    );
  }

  // Show landing / create or join
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      {/* Logo / Title */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="text-5xl font-bold text-white mb-2">
          Tysi
          <span className="text-gold-400">ą</span>c
        </h1>
        <p className="text-white/60">Polish Card Game • 1000</p>

        {/* Connection status */}
        <div className="mt-4 flex items-center justify-center gap-2">
          <span
            className={cn(
              'w-2 h-2 rounded-full',
              isConnecting
                ? 'bg-yellow-500 animate-pulse'
                : isConnected
                ? 'bg-green-500'
                : 'bg-red-500'
            )}
          />
          <span className="text-xs text-white/60">
            {isConnecting
              ? 'Connecting...'
              : isConnected
              ? 'Connected'
              : 'Disconnected'}
          </span>
        </div>
      </motion.div>

      {/* Tab switcher */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex gap-2 mb-6 bg-table-900/50 p-1 rounded-lg"
      >
        <button
          onClick={() => setTab('create')}
          className={cn(
            'px-6 py-2 rounded-md font-medium transition-all',
            tab === 'create'
              ? 'bg-gold-500 text-table-950'
              : 'text-white/60 hover:text-white'
          )}
        >
          Create Room
        </button>
        <button
          onClick={() => setTab('join')}
          className={cn(
            'px-6 py-2 rounded-md font-medium transition-all',
            tab === 'join'
              ? 'bg-gold-500 text-table-950'
              : 'text-white/60 hover:text-white'
          )}
        >
          Join Room
        </button>
      </motion.div>

      {/* Forms */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="w-full max-w-sm min-h-[362px]"
      >
        {tab === 'create' ? (
          <CreateRoomForm
            onSubmit={createRoom}
            isLoading={isConnecting}
          />
        ) : (
          <JoinRoomForm
            onSubmit={joinRoom}
            isLoading={isConnecting}
          />
        )}
      </motion.div>

      {/* Error display */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm"
        >
          {error}
        </motion.div>
      )}

      {/* Rules summary */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-12 text-center max-w-md"
      >
        <h3 className="text-white/60 font-medium mb-3">Quick Rules</h3>
        <ul className="text-sm text-white/60 space-y-1">
          <li>• 3 players, 24-card deck (9-A in each suit)</li>
          <li>• Bid for the right to pick up the talon</li>
          <li>• Declare marriages (K+Q) for bonus points</li>
          <li>• First to 1000 points wins!</li>
        </ul>
      </motion.div>
    </main>
  );
}

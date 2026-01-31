'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { CreateRoomForm } from '@/components/lobby/CreateRoomForm';
import { JoinRoomForm } from '@/components/lobby/JoinRoomForm';
import { RoomLobby } from '@/components/lobby/RoomLobby';
import { GameBoard } from '@/components/game/GameBoard';
import { Modal, ModalHeader, ModalBody } from '@/components/ui/Modal';
import { useSocket } from '@/hooks/useSocket';
import { useRoomStore } from '@/stores/roomStore';
import { useGameStore } from '@/stores/gameStore';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';

export default function HomePage() {
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [showRulesModal, setShowRulesModal] = useState(false);
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

  // Debug logging
  console.log('[HomePage] State check:', {
    hasGameState: !!gameState,
    roomId: room?.id,
    gameId: room?.gameId,
    shouldShowGame: !!(gameState && room?.gameId)
  });

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
        <div className="flex items-center justify-center gap-2 mb-3">
          <h3 className="text-white/60 font-medium">Quick Rules</h3>
          <button
            onClick={() => setShowRulesModal(true)}
            className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white text-xs font-bold transition-all flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-gold-500"
            aria-label="View full rules"
          >
            i
          </button>
        </div>
        <ul className="text-sm text-white/60 space-y-1">
          <li>• 3 players, 24-card deck (9-A in each suit)</li>
          <li>• Bid for the right to pick up the talon</li>
          <li>• Declare marriages (K+Q) for bonus points</li>
          <li>• First to 1000 points wins!</li>
        </ul>
      </motion.div>

      {/* Full Rules Modal */}
      <Modal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
        ariaLabel="Game Rules"
        className="max-w-lg"
      >
        <ModalHeader onClose={() => setShowRulesModal(false)}>
          Tysiąc - Complete Rules
        </ModalHeader>
        <ModalBody className="space-y-4 text-sm">
          <section>
            <h4 className="text-gold-400 font-semibold mb-2">Overview</h4>
            <p className="text-white/70">
              Tysiąc (meaning "Thousand" in Polish) is a classic trick-taking card game for 3 players.
              The goal is to be the first player to reach 1000 points.
            </p>
          </section>

          <section>
            <h4 className="text-gold-400 font-semibold mb-2">The Deck</h4>
            <p className="text-white/70">
              24 cards are used: 9, 10, Jack, Queen, King, and Ace in each of the four suits
              (Hearts, Diamonds, Clubs, Spades).
            </p>
          </section>

          <section>
            <h4 className="text-gold-400 font-semibold mb-2">Card Values (in tricks)</h4>
            <ul className="text-white/70 space-y-1">
              <li>• Ace: 11 points</li>
              <li>• Ten: 10 points</li>
              <li>• King: 4 points</li>
              <li>• Queen: 3 points</li>
              <li>• Jack: 2 points</li>
              <li>• Nine: 0 points</li>
            </ul>
            <p className="text-white/50 text-xs mt-1">Total: 120 points per round</p>
          </section>

          <section>
            <h4 className="text-gold-400 font-semibold mb-2">Dealing & Bidding</h4>
            <p className="text-white/70">
              Each player receives 7 cards, and 3 cards go to the talon (hidden pile).
              Players bid for the right to pick up the talon. Minimum bid is 100, and bids increase by 10.
              The highest bidder takes the talon and must discard 3 cards (one to each opponent).
            </p>
          </section>

          <section>
            <h4 className="text-gold-400 font-semibold mb-2">Marriages (Meldy)</h4>
            <p className="text-white/70 mb-2">
              A marriage is a King and Queen of the same suit. Declaring a marriage sets that suit as trump
              and awards bonus points:
            </p>
            <ul className="text-white/70 space-y-1">
              <li>• Hearts (Kiery): 100 points</li>
              <li>• Diamonds (Kara): 80 points</li>
              <li>• Clubs (Trefle): 60 points</li>
              <li>• Spades (Piki): 40 points</li>
            </ul>
            <p className="text-white/50 text-xs mt-1">You can only declare a marriage when leading a trick.</p>
          </section>

          <section>
            <h4 className="text-gold-400 font-semibold mb-2">Playing Tricks</h4>
            <ul className="text-white/70 space-y-1">
              <li>• You must follow suit if possible</li>
              <li>• If you cannot follow suit, you must play a trump if you have one</li>
              <li>• You must beat the current winning card if you can</li>
              <li>• The highest card of the led suit wins (unless trumped)</li>
            </ul>
          </section>

          <section>
            <h4 className="text-gold-400 font-semibold mb-2">Scoring</h4>
            <p className="text-white/70">
              The bid winner must score at least their bid amount (tricks + marriages).
              If successful, they gain their bid. If not, they lose their bid.
              Other players score what they won. Scores are rounded to the nearest 5.
            </p>
          </section>

          <section>
            <h4 className="text-gold-400 font-semibold mb-2">Special Rules</h4>
            <ul className="text-white/70 space-y-1">
              <li>• <span className="text-gold-400">Wykładana:</span> All 4 nines in hand = instant 1000 points!</li>
              <li>• <span className="text-gold-400">Bombing:</span> 3 failed bids in a row = -120 points</li>
              <li>• <span className="text-gold-400">Barrel:</span> At 880+ points, you have 3 rounds to reach 1000</li>
            </ul>
          </section>

          <section>
            <h4 className="text-gold-400 font-semibold mb-2">Winning</h4>
            <p className="text-white/70">
              The first player to reach exactly 1000 points (or more) wins the game!
            </p>
          </section>
        </ModalBody>
      </Modal>
    </main>
  );
}

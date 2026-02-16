'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { CreateRoomForm } from '@/components/lobby/CreateRoomForm';
import { RoomBrowser } from '@/components/lobby/RoomBrowser';
import { RoomLobby } from '@/components/lobby/RoomLobby';
import { GameBoard } from '@/components/game/GameBoard';
import { Modal, ModalHeader, ModalBody } from '@/components/ui/Modal';
import { SettingsDropdown } from '@/components/game/SettingsDropdown';
import { useSocket } from '@/hooks/useSocket';
import { useRoomStore } from '@/stores/roomStore';
import { useGameStore } from '@/stores/gameStore';
import { AmbientParticles } from '@/components/ui/AmbientParticles';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';

function HomePageContent({ roomCodeFromUrl }: { roomCodeFromUrl: string }) {

  const [tab, setTab] = useState<'create' | 'join'>(roomCodeFromUrl ? 'join' : 'create');
  const [showRulesModal, setShowRulesModal] = useState(false);
  const { showToast } = useToast();
  const previousError = useRef<string | null>(null);

  const { room, playerId, isConnected, isConnecting, isCreatingRoom, error, publicRooms } = useRoomStore();

  // Clean up URL after reading room code (removes ?room= from URL)
  useEffect(() => {
    if (roomCodeFromUrl && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('room');
      window.history.replaceState({}, '', url.pathname);
    }
  }, [roomCodeFromUrl]);

  // Show toast when error changes
  useEffect(() => {
    if (error && error !== previousError.current) {
      showToast(error, 'error');
      previousError.current = error;
    } else if (!error) {
      previousError.current = null;
    }
  }, [error, showToast]);
  const gameState = useGameStore((s) => s.gameState);

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
      <main className="h-full flex items-center justify-center p-4 overflow-auto">
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
    <main className="h-full flex flex-col items-center justify-center p-4 overflow-auto relative">
      {/* Ambient particles */}
      <AmbientParticles count={10} />

      {/* Settings */}
      <div className="absolute top-4 right-4 z-10">
        <SettingsDropdown />
      </div>

      {/* Logo / Title */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-4 sm:mb-8"
      >
        <h1 className="text-4xl sm:text-5xl font-bold mb-1 sm:mb-2">
          <span style={{
            background: 'linear-gradient(135deg, #fff 0%, #fef3c7 30%, #fbbf24 50%, #fef3c7 70%, #fff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))',
          }}>Tysi<span style={{
            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #fbbf24 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>ą</span>c</span>
        </h1>
        <p className="text-white/60 text-sm sm:text-base">Polish Card Game • 1000</p>

        {/* Connection status */}
        <div className="mt-2 sm:mt-4 flex items-center justify-center gap-2">
          <span className="relative flex items-center justify-center w-2 h-2">
            <span
              className={cn(
                'absolute inset-0 rounded-full',
                isConnecting
                  ? 'bg-yellow-500'
                  : isConnected
                  ? 'bg-green-500'
                  : 'bg-red-500'
              )}
            />
            {(isConnected || isConnecting) && (
              <motion.span
                className={cn(
                  'absolute inset-0 rounded-full',
                  isConnecting ? 'bg-yellow-500' : 'bg-green-500'
                )}
                animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                transition={{ duration: isConnecting ? 1 : 2, repeat: Infinity, ease: 'easeOut' }}
              />
            )}
          </span>
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
        className="relative flex gap-2 mb-4 sm:mb-6 bg-table-900/50 p-1 rounded-lg backdrop-blur-sm border border-white/[0.06]"
      >
        <button
          onClick={() => setTab('create')}
          className={cn(
            'relative px-6 py-2 rounded-md font-medium transition-all z-10',
            tab === 'create'
              ? 'text-white font-semibold'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          )}
        >
          Create Room
          {tab === 'create' && (
            <motion.div
              layoutId="tab-indicator"
              className="absolute bottom-0 left-1 right-1 h-0.5 bg-gold-500 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.4)]"
            />
          )}
        </button>
        <button
          onClick={() => setTab('join')}
          className={cn(
            'relative px-6 py-2 rounded-md font-medium transition-all z-10',
            tab === 'join'
              ? 'text-white font-semibold'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          )}
        >
          Browse Rooms
          {tab === 'join' && (
            <motion.div
              layoutId="tab-indicator"
              className="absolute bottom-0 left-1 right-1 h-0.5 bg-gold-500 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.4)]"
            />
          )}
        </button>
      </motion.div>

      {/* Green Box + Blue Box — stacked in same grid cell so they always match height */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="w-full max-w-sm grid grid-cols-1 grid-rows-1"
      >
        {/* Green Box: Create Room */}
        <div className={cn(
          'col-start-1 row-start-1 transition-opacity duration-150',
          tab === 'create' ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}>
          <CreateRoomForm
            onSubmit={createRoom}
            isLoading={isConnecting || isCreatingRoom}
            isConnected={isConnected}
          />
        </div>
        {/* Blue Box: Browse Rooms */}
        <div className={cn(
          'col-start-1 row-start-1 transition-opacity duration-150',
          tab === 'join' ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}>
          <RoomBrowser
            publicRooms={publicRooms}
            onJoin={joinRoom}
            isLoading={isConnecting}
            isConnected={isConnected}
            initialCode={roomCodeFromUrl}
          />
        </div>
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

      {/* Rules summary - hidden on small mobile screens */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-6 sm:mt-12 text-center max-w-md hidden sm:block"
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
          <li>• 3-4 players, 24-card deck (9-A in each suit)</li>
          <li>• Bid for the right to pick up the talon</li>
          <li>• Declare marriages (K+Q) for bonus points</li>
          <li>• First to 1000 points wins!</li>
        </ul>
      </motion.div>

      {/* Mobile rules link */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        onClick={() => setShowRulesModal(true)}
        className="mt-4 sm:hidden text-white/60 hover:text-white text-sm underline"
      >
        View Game Rules
      </motion.button>

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
              Tysiąc (meaning &ldquo;Thousand&rdquo; in Polish) is a classic trick-taking card game for 3 or 4 players.
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
            <p className="text-white/50 text-xs mt-1">Total: 120 points per round. Every hand must have at least 18 points or a marriage, otherwise the deck is re-dealt.</p>
          </section>

          <section>
            <h4 className="text-gold-400 font-semibold mb-2">Dealing & Bidding</h4>
            <p className="text-white/70 mb-2">
              Each player receives 7 cards, and 3 cards go to the talon (hidden pile).
              Players bid for the right to pick up the talon. Minimum bid is 100, and bids
              increase by 10. Maximum bid is 120 plus the value of any marriages in your hand.
            </p>
            <p className="text-white/70">
              The highest bidder picks up the 3 talon cards, then gives 1 card to each opponent
              (keeping 8 cards to play with).
            </p>
          </section>

          <section>
            <h4 className="text-gold-400 font-semibold mb-2">Play or Pass</h4>
            <p className="text-white/70">
              After winning the bid, you can choose to <span className="text-white">play</span> or <span className="text-white">pass</span>.
              At a bid of 100, passing has no penalty. At a higher bid, passing costs you the bid amount
              and the 120 trick points are split among the other players.
            </p>
          </section>

          <section>
            <h4 className="text-gold-400 font-semibold mb-2">Marriages (Meldunek)</h4>
            <p className="text-white/70 mb-2">
              A marriage is a King and Queen of the same suit. Declaring a marriage sets that suit as trump
              and awards bonus points:
            </p>
            <ul className="text-white/70 space-y-1">
              <li>• Hearts: 100 points</li>
              <li>• Diamonds: 80 points</li>
              <li>• Clubs: 60 points</li>
              <li>• Spades: 40 points</li>
            </ul>
            <p className="text-white/50 text-xs mt-1">You can only declare a marriage when leading a trick. Marriage points only count if you win at least one trick.</p>
          </section>

          <section>
            <h4 className="text-gold-400 font-semibold mb-2">Playing Tricks</h4>
            <ul className="text-white/70 space-y-1">
              <li>• You must follow suit if possible</li>
              <li>• If the leading card is still winning, you must beat it if you can</li>
              <li>• If you can&apos;t follow suit, you may play any card</li>
              <li>• The highest card of the led suit wins (unless trumped)</li>
            </ul>
          </section>

          <section>
            <h4 className="text-gold-400 font-semibold mb-2">Scoring</h4>
            <p className="text-white/70">
              The bid winner must score at least their bid amount (tricks + marriages).
              If successful, they score what they earned (rounded to the nearest 10). If not, they lose
              their bid amount. Other players score what they won, also rounded to 10.
            </p>
          </section>

          <section>
            <h4 className="text-gold-400 font-semibold mb-2">The Barrel</h4>
            <p className="text-white/70 mb-2">
              When you reach 800+ points, you&apos;re &ldquo;on the barrel.&rdquo; You must reach exactly
              1000 to win. If you bid and make your bid but don&apos;t reach 1000, that counts as a barrel
              attempt. After 3 such attempts, your score resets to 800. If you fail to make your bid,
              you lose the bid amount as normal (this does not count as a barrel attempt).
            </p>
            <ul className="text-white/70 space-y-1">
              <li>• Non-bidders on the barrel score 0 for that round</li>
            </ul>
          </section>

          <section>
            <h4 className="text-gold-400 font-semibold mb-2">Special Rules</h4>
            <ul className="text-white/70 space-y-1">
              <li>• <span className="text-gold-400">Wykładana:</span> If the bidder&apos;s cards guarantee winning all remaining tricks, the round ends instantly</li>
            </ul>
          </section>

          <section>
            <h4 className="text-gold-400 font-semibold mb-2">4-Player Mode</h4>
            <p className="text-white/70">
              In a 4-player game, the dealer sits out each round and spectates. The dealer scores
              any marriages found in the talon, plus 50 points per ace in the talon.
            </p>
          </section>

          <section>
            <h4 className="text-gold-400 font-semibold mb-2">Winning</h4>
            <p className="text-white/70">
              The first player to reach 1000 points wins the game!
            </p>
          </section>
        </ModalBody>
      </Modal>
    </main>
  );
}

function HomePageWithSearchParams() {
  const searchParams = useSearchParams();
  const roomCodeFromUrl = searchParams.get('room')?.toUpperCase() || '';
  return <HomePageContent roomCodeFromUrl={roomCodeFromUrl} />;
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="h-full flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </div>
    }>
      <HomePageWithSearchParams />
    </Suspense>
  );
}

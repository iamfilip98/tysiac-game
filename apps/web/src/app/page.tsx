'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth, useUser, useClerk } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { CreateRoomForm } from '@/components/lobby/CreateRoomForm';
import { QuickPlayButton } from '@/components/lobby/QuickPlayButton';
import { RoomBrowser } from '@/components/lobby/RoomBrowser';
import { RoomLobby } from '@/components/lobby/RoomLobby';
import { GameBoard } from '@/components/game/GameBoard';
import { RulesModal } from '@/components/game/RulesModal';
import { SettingsDropdown } from '@/components/game/SettingsDropdown';
import { AuthGate } from '@/components/auth/AuthGate';
import { UserBadge } from '@/components/auth/UserBadge';
import { useSocket } from '@/hooks/useSocket';
import { useRoomStore, useGameStore } from '@tysiac/game-logic';
import { AmbientParticles } from '@/components/ui/AmbientParticles';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import type { PlayerStatsPublic } from '@tysiac/shared';

function HomePageContent({ roomCodeFromUrl }: { roomCodeFromUrl: string }) {

  const [tab, setTab] = useState<'create' | 'join'>(roomCodeFromUrl ? 'join' : 'create');
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [authStats, setAuthStats] = useState<PlayerStatsPublic | null>(null);
  const { showToast } = useToast();
  const previousError = useRef<string | null>(null);

  const { room, playerId, isConnected, isConnecting, isCreatingRoom, error, publicRooms, isSearching, searchPlayerCount } = useRoomStore();

  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();

  const isAuthenticated = !!isSignedIn;
  const authDisplayName = user?.firstName || user?.username || null;

  // Fetch stats from server when signed in
  useEffect(() => {
    if (!isSignedIn) {
      setAuthStats(null);
      return;
    }
    const fetchStats = async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const API_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
        const res = await fetch(`${API_URL}/stats/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setAuthStats(data);
        }
      } catch { /* stats fetch not critical */ }
    };
    fetchStats();
  }, [isSignedIn, getToken]);

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
    joinMatchmaking,
    leaveMatchmaking,
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

  // Default player name for authenticated users
  const defaultPlayerName = isAuthenticated && authDisplayName ? authDisplayName : '';

  // Show landing page
  // If not authenticated and not guest, show auth gate above room tabs
  const showAuthGate = !isAuthenticated && !isGuest;

  return (
    <main className="h-full flex flex-col items-center p-4 overflow-auto relative">
      {/* Ambient particles */}
      <AmbientParticles count={10} />

      {/* Settings + User badge */}
      <div className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 z-10 flex items-center gap-2">
        {isAuthenticated && authDisplayName ? (
          <UserBadge
            displayName={authDisplayName}
            stats={authStats}
            onLogout={() => signOut()}
          />
        ) : isGuest ? (
          <button
            onClick={() => setIsGuest(false)}
            className="btn-toolbar min-h-[44px] px-3 py-1.5 rounded-lg text-white/70 hover:text-white text-[13px] font-medium tracking-wide transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            <span className="hidden sm:inline">Sign in</span>
          </button>
        ) : null}
        <SettingsDropdown />
      </div>

      {/* Wrapper for safe vertical centering (my-auto avoids justify-center scroll clipping) */}
      <div className="my-auto flex flex-col items-center w-full py-4">

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

      {/* Auth gate — shown when user is neither authenticated nor playing as guest */}
      {showAuthGate ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <AuthGate
            onPlayAsGuest={() => setIsGuest(true)}
          />
        </motion.div>
      ) : isSearching ? (
        /* Searching state — replaces tabs and forms */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <QuickPlayButton
            onJoin={joinMatchmaking}
            onCancel={leaveMatchmaking}
            isSearching={true}
            searchPlayerCount={searchPlayerCount}
            isConnected={isConnected}
            defaultPlayerName={defaultPlayerName}
            isAuthenticated={isAuthenticated}
          />
        </motion.div>
      ) : (
        <>
          {/* Quick Play button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="w-full max-w-sm"
          >
            <QuickPlayButton
              onJoin={joinMatchmaking}
              onCancel={leaveMatchmaking}
              isSearching={false}
              searchPlayerCount={0}
              isConnected={isConnected}
              defaultPlayerName={defaultPlayerName}
              isAuthenticated={isAuthenticated}
            />
          </motion.div>

          {/* "or" divider */}
          <div className="flex items-center gap-3 w-full max-w-sm my-3 sm:my-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-white/40 text-xs uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

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
                defaultPlayerName={defaultPlayerName}
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
                defaultPlayerName={defaultPlayerName}
              />
            </div>
          </motion.div>

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
        </>
      )}

      </div>{/* end safe-center wrapper */}

      {/* Full Rules Modal */}
      <RulesModal isOpen={showRulesModal} onClose={() => setShowRulesModal(false)} />
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

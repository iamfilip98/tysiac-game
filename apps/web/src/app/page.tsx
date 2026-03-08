'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth, useUser, useClerk } from '@clerk/nextjs';
import { motion } from 'framer-motion';
import { CreateRoomForm } from '@/components/lobby/CreateRoomForm';
import { QuickPlayButton } from '@/components/lobby/QuickPlayButton';
import { RoomBrowser } from '@/components/lobby/RoomBrowser';
import { RoomLobby } from '@/components/lobby/RoomLobby';
import { GameBoard } from '@/components/game/GameBoard';
import { RulesModal } from '@/components/game/RulesModal';
import { AuthGate } from '@/components/auth/AuthGate';
import { UserBadge } from '@/components/auth/UserBadge';
import { RejoinBanner } from '@/components/lobby/RejoinBanner';
import { ReconnectModal } from '@/components/lobby/ReconnectModal';
import { ProfileModal } from '@/components/profile/ProfileModal';
import { Input } from '@/components/ui/Input';
import { useSocket } from '@/hooks/useSocket';
import { useRoomStore, useGameStore, usePreferencesStore } from '@tysiac/game-logic';
import { AmbientParticles } from '@/components/ui/AmbientParticles';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';
import type { PlayerStatsPublic } from '@tysiac/shared';

function HomePageContent({ roomCodeFromUrl }: { roomCodeFromUrl: string }) {

  const [tab, setTab] = useState<'quick' | 'create' | 'join'>(roomCodeFromUrl ? 'join' : 'quick');
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [authStats, setAuthStats] = useState<PlayerStatsPublic | null>(null);
  const { showToast } = useToast();
  const previousError = useRef<string | null>(null);

  const { room, playerId, isConnected, isConnecting, isCreatingRoom, error, publicRooms, isSearching, searchPlayerCount, reconnectStatus } = useRoomStore();
  const { guestName, setGuestName, avatarEmoji, setAvatarEmoji, tutorialCompleted, setTutorialCompleted } = usePreferencesStore();

  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();

  const isAuthenticated = !!isSignedIn;
  const authDisplayName = user?.firstName || user?.username || null;

  // Close profile modal when auth state changes (e.g., unexpected logout in web clips)
  useEffect(() => {
    if (!isAuthenticated && !isGuest) {
      setShowProfile(false);
    }
  }, [isAuthenticated, isGuest]);

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
  const showGameEnd = useGameStore((s) => s.showGameEnd);

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

  // Tutorial flow — chains: createRoom → addAI x2 → setReady → startGame
  type TutorialStep = 'idle' | 'waitRoom' | 'waitPlayers' | 'waitReady' | 'waitStart';
  const [tutorialStep, setTutorialStep] = useState<TutorialStep>('idle');

  const startTutorial = useCallback(() => {
    if (!isConnected) return;
    // Enter as guest if not authenticated
    if (!isAuthenticated) {
      setIsGuest(true);
      if (!guestName.trim()) setGuestName('Player');
    }
    const name = isAuthenticated && authDisplayName ? authDisplayName : (guestName.trim() || 'Player');
    setTutorialStep('waitRoom');
    createRoom(name, 'Tutorial', true, 3);
  }, [isConnected, isAuthenticated, authDisplayName, guestName, setGuestName, createRoom]);

  // Chain tutorial steps based on room state changes
  useEffect(() => {
    if (tutorialStep === 'idle') return;

    if (tutorialStep === 'waitRoom' && room && room.name === 'Tutorial' && playerId) {
      setTutorialStep('waitPlayers');
      addAI();
      setTimeout(() => addAI(), 500);
      return;
    }

    if (tutorialStep === 'waitPlayers' && room && room.players.length >= 3) {
      setTutorialStep('waitReady');
      setReady(true);
      return;
    }

    if (tutorialStep === 'waitReady' && room && room.players.find(p => p.id === playerId)?.isReady) {
      setTutorialStep('waitStart');
      startGame();
      return;
    }

    if (tutorialStep === 'waitStart' && gameState) {
      setTutorialStep('idle');
    }
  }, [tutorialStep, room, playerId, gameState, addAI, setReady, startGame]);

  // If there's an active game, show the game board
  if (gameState && (room?.gameId || showGameEnd)) {
    return <GameBoard />;
  }

  // If in a room, show the lobby (skip for tutorial — auto-setup in progress)
  if (room && playerId) {
    if (tutorialStep !== 'idle') {
      return (
        <main className="h-full flex items-center justify-center p-4 overflow-auto">
          <div className="text-white/80 flex items-center gap-3">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Setting up tutorial...
          </div>
        </main>
      );
    }
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

  // Shared player name: authenticated users use their display name, guests use the persisted name
  const defaultPlayerName = isAuthenticated && authDisplayName ? authDisplayName : '';
  const playerName = isAuthenticated ? defaultPlayerName : guestName.trim();
  const nameReady = playerName.length > 0;

  // Show landing page
  // If not authenticated and not guest, show auth gate above room tabs
  const showAuthGate = !isAuthenticated && !isGuest;

  const tabs = [
    { key: 'quick' as const, label: 'Quick Play' },
    { key: 'create' as const, label: 'Create' },
    { key: 'join' as const, label: 'Browse' },
  ];

  return (
    <main className="h-full flex flex-col items-center p-4 overflow-auto relative">
      {/* Ambient particles */}
      <AmbientParticles count={10} />

      {/* User badge / Profile button */}
      {(isAuthenticated || isGuest) && (
        <div className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 z-10">
          <UserBadge
            displayName={isAuthenticated && authDisplayName ? authDisplayName : (guestName.trim() || 'Guest')}
            avatarEmoji={avatarEmoji}
            onProfileClick={() => setShowProfile(true)}
          />
        </div>
      )}

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
          className="w-full max-w-sm"
        >
          <AuthGate
            onPlayAsGuest={() => setIsGuest(true)}
          />
        </motion.div>
      ) : isSearching ? (
        /* Searching state — replaces the entire card */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-sm"
        >
          <div
            className="rounded-xl border border-gold-500/20 bg-gradient-to-b from-table-800/90 to-table-900/90 backdrop-blur-md p-6"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}
          >
            <QuickPlayButton
              onJoin={() => joinMatchmaking(playerName)}
              onCancel={leaveMatchmaking}
              isSearching={true}
              searchPlayerCount={searchPlayerCount}
              isConnected={isConnected}
            />
          </div>
        </motion.div>
      ) : (
        <>
          {/* Rejoin banner for authenticated users with an active game (hidden during reconnect modal) */}
          {reconnectStatus === 'idle' && (
            <RejoinBanner
              isConnected={isConnected}
              onRejoin={(roomCode) => joinRoom(playerName || 'Player', roomCode)}
            />
          )}

          {/* Single tabbed card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="w-full max-w-sm"
          >
            <div
              className="rounded-xl border border-gold-500/20 shadow-glow-gold transition-shadow duration-300 hover:shadow-[0_0_30px_rgba(251,191,36,0.2)] bg-gradient-to-b from-table-800/90 to-table-900/90 backdrop-blur-md p-6"
              style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}
            >
              {/* Shared guest name input — only for non-authenticated users */}
              {!isAuthenticated && (
                <div className="mb-5">
                  <Input
                    id="guestName"
                    label="Your Name"
                    placeholder="Enter your name"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    maxLength={20}
                    required
                  />
                </div>
              )}

              {/* Tab switcher */}
              <div className="relative flex gap-1 mb-5 bg-table-900/50 p-1 rounded-lg border border-white/[0.06]">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={cn(
                      'relative flex-1 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors z-10',
                      tab === t.key
                        ? 'text-white font-semibold'
                        : 'text-white/60 hover:text-white'
                    )}
                  >
                    {t.label}
                    {tab === t.key && (
                      <motion.div
                        layoutId="tab-indicator"
                        className="absolute inset-0 rounded-md bg-white/10"
                        transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Tab content — stacked in same grid cell for height matching */}
              <div className="grid grid-cols-1 grid-rows-1">
                {/* Quick Play */}
                <div className={cn(
                  'col-start-1 row-start-1',
                  tab === 'quick' ? 'opacity-100' : 'opacity-0 pointer-events-none'
                )}>
                  <QuickPlayButton
                    onJoin={() => joinMatchmaking(playerName)}
                    onCancel={leaveMatchmaking}
                    isSearching={false}
                    searchPlayerCount={0}
                    isConnected={isConnected}
                    disabled={!nameReady}
                  />
                </div>
                {/* Create Room */}
                <div className={cn(
                  'col-start-1 row-start-1',
                  tab === 'create' ? 'opacity-100' : 'opacity-0 pointer-events-none'
                )}>
                  <CreateRoomForm
                    onSubmit={(roomName, isPrivate, maxPlayers) => createRoom(playerName, roomName, isPrivate, maxPlayers)}
                    isLoading={isConnecting || isCreatingRoom}
                    isConnected={isConnected}
                    disabled={!nameReady}
                  />
                </div>
                {/* Browse Rooms */}
                <div className={cn(
                  'col-start-1 row-start-1',
                  tab === 'join' ? 'opacity-100' : 'opacity-0 pointer-events-none'
                )}>
                  <RoomBrowser
                    publicRooms={publicRooms}
                    onJoin={(roomCode) => joinRoom(playerName, roomCode)}
                    isLoading={isConnecting}
                    isConnected={isConnected}
                    initialCode={roomCodeFromUrl}
                    disabled={!nameReady}
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Learn to Play / Replay Tutorial */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="mt-4 w-full max-w-sm"
          >
            <button
              onClick={() => {
                setTutorialCompleted(false);
                startTutorial();
              }}
              disabled={!isConnected || tutorialStep !== 'idle'}
              className="w-full py-2.5 px-4 rounded-lg border border-gold-500/20 bg-gold-500/[0.06] hover:bg-gold-500/12 text-gold-400/80 hover:text-gold-400 font-medium text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
              {tutorialCompleted ? 'Replay Tutorial' : 'Learn to Play'}
            </button>
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

      {/* Footer */}
      <div className="w-full text-center py-3 mt-auto">
        <a href="/privacy" className="text-white/30 hover:text-white/50 text-xs transition-colors">
          Privacy Policy
        </a>
      </div>

      {/* Full Rules Modal */}
      <RulesModal isOpen={showRulesModal} onClose={() => setShowRulesModal(false)} />

      {/* Reconnect Modal */}
      <ReconnectModal />

      {/* Profile Modal */}
      <ProfileModal
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
        isAuthenticated={isAuthenticated}
        displayName={isAuthenticated && authDisplayName ? authDisplayName : (guestName.trim() || 'Guest')}
        avatarUrl={user?.imageUrl}
        avatarEmoji={avatarEmoji}
        onAvatarChange={setAvatarEmoji}
        onNameChange={setGuestName}
        stats={authStats}
        onLogout={() => signOut()}
        onSignUp={() => { setIsGuest(false); setShowProfile(false); }}
        onShowRules={() => setShowRulesModal(true)}
      />
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

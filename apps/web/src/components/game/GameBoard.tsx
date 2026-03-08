'use client';

import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlayerHand } from './PlayerHand';
import { OpponentHand } from './OpponentHand';
import { TrickPile } from './TrickPile';
import { ScoreBoard } from './ScoreBoard';
import { TalonDisplay } from './TalonPanel';
import { GameActionPanels } from './GameActionPanels';
import { GameOverlays } from './GameOverlays';
import { TutorialOverlay } from './TutorialOverlay';
import { SettingsDropdown } from './SettingsDropdown';
import { EmoteButton } from './EmoteButton';
import { EmoteBubble } from './EmoteBubble';
import { Button } from '@/components/ui/Button';
import { useGameStore, useRoomStore, usePreferencesStore } from '@tysiac/game-logic';
import { useSocket } from '@/hooks/useSocket';
import { useToast } from '@/components/ui/Toast';
import { useScreenSize } from '@/hooks/useIsMobile';
import { AmbientParticles } from '@/components/ui/AmbientParticles';
import { cn } from '@/lib/utils';
import { useShallow } from 'zustand/react/shallow';
import type { Card as CardType } from '@tysiac/shared';

// Layout positions based on screen dimensions
// Compact: very small phones (<600px height, e.g. iPhone SE)
// Normal: standard mobile (600-900px, e.g. iPhone 16 Pro at 852px)
// Large: desktop/tablets (>900px)
function getLayoutPositions(isMobile: boolean, height: number, phase?: string) {
  const isCompact = isMobile && height < 600;
  const isDistribution = phase === 'talonDistribution';

  return {
    opponents: isMobile ? (isCompact ? 'top-16' : 'top-20') : 'top-24',
    opponentsLeftRight: isMobile ? (isCompact ? 'left-1 right-1' : 'left-2 right-2') : 'left-8 right-8',
    actionPanel: isDistribution
      ? (isMobile ? (isCompact ? 'bottom-36' : 'bottom-40') : 'bottom-44')
      : (isMobile ? (isCompact ? 'bottom-28' : 'bottom-32') : 'bottom-36'),
    playerHand: isMobile ? 'bottom-2' : 'bottom-4',
    spectatingHand: isMobile ? 'bottom-16' : 'bottom-20',
    turnArea: isMobile ? (isCompact ? 'bottom-32' : 'bottom-36') : 'bottom-40',
    spectatingIndicator: isMobile ? 'bottom-2' : 'bottom-4',
    centerArea: isMobile ? (isCompact ? 'top-52 bottom-32' : 'top-64 bottom-36') : '',
  };
}

export function GameBoard() {
  const { isMobile, height } = useScreenSize();
  const { showToast } = useToast();
  const emotesEnabled = usePreferencesStore((s) => s.emotesEnabled);
  const { playerId, room } = useRoomStore();
  const {
    gameState,
    validActions,
    selectedCard,
    lastRoundResult,
    showRoundResult,
    showGameEnd,
    isMyTurn,
    lastMarriageDeclared,
    wykladanaData,
    showWykladana,
    gameStatistics,
    passedAt100Notification,
    threwNotification,
    pauseData,
    trickWonData,
    activeEmotes,
  } = useGameStore(useShallow((s) => ({
    gameState: s.gameState,
    validActions: s.validActions,
    selectedCard: s.selectedCard,
    lastRoundResult: s.lastRoundResult,
    showRoundResult: s.showRoundResult,
    showGameEnd: s.showGameEnd,
    isMyTurn: s.isMyTurn,
    lastMarriageDeclared: s.lastMarriageDeclared,
    wykladanaData: s.wykladanaData,
    showWykladana: s.showWykladana,
    gameStatistics: s.gameStatistics,
    passedAt100Notification: s.passedAt100Notification,
    threwNotification: s.threwNotification,
    pauseData: s.pauseData,
    trickWonData: s.trickWonData,
    activeEmotes: s.activeEmotes,
  })));
  const selectCard = useGameStore((s) => s.selectCard);
  const setPassedAt100Notification = useGameStore((s) => s.setPassedAt100Notification);
  const setThrewNotification = useGameStore((s) => s.setThrewNotification);
  const setShowRoundResult = useGameStore((s) => s.setShowRoundResult);

  const {
    bid,
    pass,
    playCard,
    distributeTalon,
    confirmTalon,
    confirmWykladana,
    playOrPass,
    leaveRoom,
    leaveGame,
    startGame,
    pauseGame,
    resumeGame,
    sendEmote,
  } = useSocket();

  // Get current player info
  const myPlayer = gameState?.players.find((p) => p.id === playerId);
  const isSpectating = gameState?.isSpectating || false;
  const playerCount = gameState?.players.length || 3;

  // Order other players: left = next player (clockwise), right = previous player
  // In 4-player mode, only 3 players are active (dealer sits out), so use same layout as 3-player
  const otherPlayers = useMemo(() => {
    if (!gameState || !playerId) return [];
    const myIndex = gameState.players.findIndex((p) => p.id === playerId);
    if (myIndex === -1) return [];

    if (gameState.players.length === 4) {
      const dealerId = gameState.round?.dealer;

      // Collect other players in clockwise order, excluding dealer
      const otherActive: typeof gameState.players = [];
      for (let i = 1; i <= 3; i++) {
        const player = gameState.players[(myIndex + i) % 4];
        if (player.id !== dealerId) {
          otherActive.push(player);
        }
      }
      // Returns 2 players for active player, 3 players for spectating dealer
      return otherActive;
    } else {
      // 3-player layout: left, right
      const leftPlayer = gameState.players[(myIndex + 1) % 3];
      const rightPlayer = gameState.players[(myIndex + 2) % 3];
      return [leftPlayer, rightPlayer];
    }
  }, [gameState, playerId]);

  // Find the dealer opponent (for 4-player mode, to show at their position)
  const dealerOpponent = useMemo(() => {
    if (!gameState || !playerId || gameState.players.length !== 4) return null;
    const dealerId = gameState.round?.dealer;
    if (!dealerId || dealerId === playerId) return null;
    return gameState.players.find(p => p.id === dealerId) || null;
  }, [gameState, playerId]);


  // Check if selected card is playable (for Play Card button)
  const isSelectedCardPlayable = useMemo(() => {
    if (!selectedCard) return false;
    const playAction = validActions.find((a) => a.type === 'playCard');
    if (playAction && playAction.type === 'playCard') {
      return playAction.validCards.some(
        (c) => c.suit === selectedCard.suit && c.rank === selectedCard.rank
      );
    }
    return false;
  }, [selectedCard, validActions]);

  // Track talon confirmation state
  const [hasConfirmedTalon, setHasConfirmedTalon] = useState(false);

  // Track leave game modal
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  // Talon distribution state
  const [distributionTarget, setDistributionTarget] = useState<string | null>(null);
  const [distributionCards, setDistributionCards] = useState<Map<string, CardType>>(new Map());
  const [distributionSubmitted, setDistributionSubmitted] = useState(false);

  // Reset confirmation state when phase changes
  useEffect(() => {
    if (gameState?.phase !== 'talonReveal') {
      setHasConfirmedTalon(false);
    }
  }, [gameState?.phase]);

  // Reset distribution state when phase changes
  useEffect(() => {
    if (gameState?.phase !== 'talonDistribution') {
      setDistributionTarget(null);
      setDistributionCards(new Map());
      setDistributionSubmitted(false);
    }
  }, [gameState?.phase]);


  // Distribution card selection handler
  const handleDistributionCardSelect = (card: CardType) => {
    if (!distributionTarget) return;

    const newSelected = new Map(distributionCards);

    // Check if card is already selected for someone else
    newSelected.forEach((selectedCard, pId) => {
      if (selectedCard.suit === card.suit && selectedCard.rank === card.rank) {
        newSelected.delete(pId);
      }
    });

    // Assign to current target
    newSelected.set(distributionTarget, card);
    setDistributionCards(newSelected);

    // Auto-switch to next player without a card
    const nextPlayer = otherPlayers.slice(0, 2).find((p) => !newSelected.has(p.id));
    setDistributionTarget(nextPlayer?.id || null);
  };

  // Handle distribution submit
  const handleDistributeSubmit = () => {
    if (distributionSubmitted) return;
    setDistributionSubmitted(true);
    const distribution: { playerId: string; card: CardType }[] = [];
    distributionCards.forEach((card, pId) => {
      distribution.push({ playerId: pId, card });
    });
    distributeTalon(distribution);
  };

  // Auto-confirm talon for spectating players (dealer in 4-player mode)
  useEffect(() => {
    if (isSpectating && gameState?.phase === 'talonReveal' && !hasConfirmedTalon) {
      setHasConfirmedTalon(true);
      confirmTalon();
    }
  }, [isSpectating, gameState?.phase, hasConfirmedTalon, confirmTalon]);


  const { isConnected, isConnecting } = useRoomStore(useShallow((s) => ({
    isConnected: s.isConnected,
    isConnecting: s.isConnecting,
  })));

  if (!gameState || !playerId) {
    const loadingMessage = !isConnected && !isConnecting
      ? 'Reconnecting to game...'
      : !isConnected
      ? 'Connecting to server...'
      : 'Waiting for game data...';

    return (
      <div className="flex items-center justify-center h-screen" role="status" aria-label="Loading game">
        <div className="text-white/80 flex items-center gap-3">
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {loadingMessage}
        </div>
      </div>
    );
  }

  const { phase, round, myHand, talon, scores } = gameState;
  const isTutorial = room?.name === 'Tutorial';
  const layout = getLayoutPositions(isMobile, height, phase);

  // Calculate opponent hand sizes
  const getOpponentHandSize = (opponentId: string) => {
    // During distribution, bid winner has 10 cards, others have 7
    if (phase === 'talonDistribution' && round?.bidWinner === opponentId) {
      return 10;
    }
    // After distribution, everyone should have 8 (if tricks started)
    if (phase === 'trickPlaying' && round) {
      const baseCount = 8 - round.completedTricks;
      const hasPlayedInCurrentTrick = (round.currentTrick?.cards || [])
        .some(c => c.playerId === opponentId);
      return baseCount - (hasPlayedInCurrentTrick ? 1 : 0);
    }
    return 7;
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Background atmosphere */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse 70% 50% at 50% 50%, rgb(var(--table-700) / 0.3) 0%, transparent 70%)',
      }} />
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,0.3) 100%)',
      }} />
      <AmbientParticles count={8} color="rgba(255,255,255,0.04)" />

      {/* Top-left button bar */}
      <div className="absolute top-[max(1rem,env(safe-area-inset-top))] left-2 sm:left-4 z-30 flex gap-1 sm:gap-2">
        <button
          onClick={() => setShowLeaveModal(true)}
          className="btn-toolbar min-w-[44px] min-h-[44px] px-2 sm:px-3 py-1.5 rounded-lg text-white/80 hover:text-white text-[13px] font-medium tracking-wide transition-colors flex items-center justify-center gap-1.5"
          title="Leave game"
        >
          <svg className="w-[18px] h-[18px] opacity-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 21h4a2 2 0 002-2V5a2 2 0 00-2-2h-4" />
            <polyline points="8 17 3 12 8 7" />
            <line x1="3" y1="12" x2="15" y2="12" />
          </svg>
          <span className="hidden sm:inline">Leave</span>
        </button>
        {room?.isPrivate && phase !== 'gameEnd' && !gameState.isPaused && (
          <button
            onClick={pauseGame}
            className="btn-toolbar btn-toolbar-gold min-w-[44px] min-h-[44px] px-2 sm:px-3 py-1.5 rounded-lg text-white/80 hover:text-gold-400 text-[13px] font-medium tracking-wide transition-colors flex items-center justify-center gap-1.5"
            title="Pause game"
          >
            <svg className="w-[18px] h-[18px] opacity-90" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
            <span className="hidden sm:inline">Pause</span>
          </button>
        )}
        {room?.isPrivate && room?.code && (
          <button
            onClick={() => {
              navigator.clipboard?.writeText(room.code!);
              showToast('Room code copied to clipboard', 'success');
            }}
            className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white/70 text-xs font-mono transition-colors"
            title="Click to copy room code"
          >
            {room.code}
          </button>
        )}
      </div>

      {/* Top-right settings */}
      <div className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 z-30">
        <SettingsDropdown />
      </div>

      {/* Emote button — left-center on mobile (aligned with trick area), bottom-left on desktop */}
      {emotesEnabled && (
        <div className={cn(
          'absolute z-40',
          isMobile ? 'left-2 top-1/2 -translate-y-1/2' : 'bottom-4 left-4'
        )}>
          <EmoteButton sendEmote={sendEmote} />
        </div>
      )}

      {/* Score board - top center */}
      <div className="absolute top-[max(1rem,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-20">
        <ScoreBoard
          players={gameState.players}
          scores={scores}
          currentPlayerId={playerId}
          bidWinner={round?.bidWinner}
          finalBid={round?.finalBid}
          trumpSuit={round?.trumpSuit}
          dealerId={round?.dealer}
          roundNumber={round?.roundNumber}
          completedTricks={round?.completedTricks}
          phase={phase}
        />

      </div>


      {/* Opponents */}
      <div className={cn(
        'absolute z-10',
        layout.opponents,
        isMobile ? 'left-2' : 'left-8'
      )}>
        {otherPlayers[0] && (
          <OpponentHand
            cardCount={getOpponentHandSize(otherPlayers[0].id)}
            position="left"
            playerName={otherPlayers[0].name}
            isCurrentTurn={
              round?.currentTrick?.currentPlayer === otherPlayers[0].id
            }
          />
        )}
      </div>

      <div className={cn(
        'absolute z-10',
        layout.opponents,
        isMobile ? 'right-2' : 'right-8'
      )}>
        {otherPlayers[1] && (
          <OpponentHand
            cardCount={getOpponentHandSize(otherPlayers[1].id)}
            position="right"
            playerName={otherPlayers[1].name}
            isCurrentTurn={
              round?.currentTrick?.currentPlayer === otherPlayers[1].id
            }
          />
        )}
      </div>

      {/* Emote bubbles near opponents */}
      {emotesEnabled && (
        <AnimatePresence>
          {otherPlayers[0] && activeEmotes[otherPlayers[0].id] && (
            <motion.div
              key={`emote-left-${activeEmotes[otherPlayers[0].id].timestamp}`}
              className={cn('absolute z-50', isMobile ? 'left-2 top-36' : 'left-8 top-40')}
            >
              <EmoteBubble emoteId={activeEmotes[otherPlayers[0].id].emoteId} playerName={otherPlayers[0].name} />
            </motion.div>
          )}
          {otherPlayers[1] && activeEmotes[otherPlayers[1].id] && (
            <motion.div
              key={`emote-right-${activeEmotes[otherPlayers[1].id].timestamp}`}
              className={cn('absolute z-50', isMobile ? 'right-2 top-36' : 'right-8 top-40')}
            >
              <EmoteBubble emoteId={activeEmotes[otherPlayers[1].id].emoteId} playerName={otherPlayers[1].name} />
            </motion.div>
          )}
          {playerId && activeEmotes[playerId] && (
            <motion.div
              key={`emote-self-${activeEmotes[playerId].timestamp}`}
              className={cn('absolute z-50', isMobile ? 'left-14 top-1/2 -translate-y-1/2' : 'left-1/2 -translate-x-1/2 bottom-40')}
            >
              <EmoteBubble emoteId={activeEmotes[playerId].emoteId} playerName="You" />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Dealer spectating indicator (4-player mode, when another player is dealer) */}
      {dealerOpponent && (
        <div className={cn(
          'absolute z-10 left-1/2 -translate-x-1/2',
          isMobile ? 'top-32' : 'top-36'
        )}>
          <div className="flex flex-col items-center gap-1 opacity-50">
            <div className="text-xs font-medium px-2 py-1 rounded-lg text-white/60 bg-table-800/80 border border-white/[0.06] flex items-center max-w-[8rem] sm:max-w-[12rem]">
              <span className="truncate">{dealerOpponent.name}</span>
              <span className="ml-1.5 text-amber-400/80 text-[10px] shrink-0">Dealing</span>
            </div>
          </div>
        </div>
      )}

      {/* Center area - trick pile / talon */}
      <div className={cn(
        'absolute flex items-center justify-center',
        isMobile ? `inset-x-0 ${layout.centerArea}` : 'inset-0'
      )}>
        <AnimatePresence mode="wait">
          {/* Dealing / Bidding - show talon */}
          {(phase === 'dealing' || phase === 'bidding') && (
            <motion.div
              key="talon-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <TalonDisplay talon={[]} isRevealed={false} />
            </motion.div>
          )}

          {/* Talon reveal (not during playOrPassDecision - cards are in hand then) */}
          {phase === 'talonReveal' && talon && (
            <motion.div
              key="talon-reveal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4"
            >
              <TalonDisplay talon={talon} isRevealed={true} />
              {phase === 'talonReveal' && !hasConfirmedTalon && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => {
                    setHasConfirmedTalon(true);
                    confirmTalon();
                  }}
                  className="px-6 py-2 bg-gold-500 hover:bg-gold-400 text-black font-bold rounded-lg transition-colors shadow-lg"
                >
                  Continue
                </motion.button>
              )}
              {phase === 'talonReveal' && hasConfirmedTalon && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-white/60 text-sm"
                >
                  Waiting for other players...
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Trick playing - show trick pile */}
          {phase === 'trickPlaying' && round?.currentTrick && (
            <motion.div
              key="trick"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <TrickPile
                cards={round.currentTrick.cards}
                players={
                  isSpectating
                    ? otherPlayers
                    : playerCount === 4
                      ? gameState.players.filter(p => p.id !== round?.dealer)
                      : gameState.players
                }
                currentPlayerId={isSpectating ? otherPlayers[0]?.id : playerId}
                marriageCard={lastMarriageDeclared ? { suit: lastMarriageDeclared.suit } : null}
                isSpectating={isSpectating}
                trumpWin={trickWonData?.wasTrumpWin}
                trumpSuit={round?.trumpSuit}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action panels */}
      <div className={cn(
        'absolute left-1/2 -translate-x-1/2 z-30 w-full px-4 sm:w-auto sm:px-0',
        layout.actionPanel
      )}>
        <GameActionPanels
          phase={phase}
          validActions={validActions}
          currentBid={round?.finalBid || 100}
          onBid={bid}
          onPass={pass}
          isMyTurn={isMyTurn}
          onPlayOrPass={playOrPass}
          isBidWinner={round?.bidWinner === playerId}
          bidAmount={round?.finalBid || 100}
          playerCount={playerCount}
          bidWinnerName={gameState.players.find(p => p.id === round?.bidWinner)?.name}
          hasCardsToDistribute={!!gameState.cardsToDistribute}
          otherPlayers={otherPlayers.slice(0, 2)}
          distributionCards={distributionCards}
          distributionTarget={distributionTarget}
          onSelectTarget={setDistributionTarget}
          onDistributeSubmit={handleDistributeSubmit}
        />
      </div>

      {/* Spectating indicator for dealer in 4-player mode */}
      {isSpectating && (
        <div className={cn(
          'absolute left-1/2 -translate-x-1/2 z-20',
          layout.spectatingIndicator
        )}>
          <div className="px-4 py-2 bg-table-800/95 border border-amber-500/50 rounded-lg text-center shadow-lg" style={{ boxShadow: '0 0 20px rgba(245,158,11,0.15)' }}>
            <div className="text-amber-400 text-sm font-medium">
              You are the dealer — spectating this round
            </div>
          </div>
        </div>
      )}

      {/* Player's hand or Third active player (when spectating) */}
      <div className={cn(
        'absolute left-1/2 -translate-x-1/2 z-10',
        isSpectating ? layout.spectatingHand : layout.playerHand
      )}>
        {isSpectating ? (
          // Show third active player at bottom center when spectating (horizontal layout)
          otherPlayers[2] && (
            <OpponentHand
              cardCount={getOpponentHandSize(otherPlayers[2].id)}
              position="top"
              playerName={otherPlayers[2].name}
              isCurrentTurn={round?.currentTrick?.currentPlayer === otherPlayers[2].id}
            />
          )
        ) : (
          <PlayerHand
            cards={myHand}
            validActions={validActions}
            selectedCard={selectedCard}
            onSelectCard={selectCard}
            onPlayCard={playCard}
            isMyTurn={isMyTurn && phase === 'trickPlaying'}
            declaredMarriages={round?.declaredMarriages?.[playerId] || []}
            phase={phase}
            trumpSuit={round?.trumpSuit}
            distributionState={
              phase === 'talonDistribution' && round?.bidWinner === playerId
                ? {
                    currentTarget: distributionTarget,
                    selectedCards: distributionCards,
                    targetNames: new Map(otherPlayers.slice(0, 2).map(p => [p.id, p.name])),
                    onCardSelect: handleDistributionCardSelect,
                  }
                : undefined
            }
          />
        )}
      </div>

      {/* Turn area — Play Card button + turn indicator in a single column */}
      {isMyTurn && phase === 'trickPlaying' && (
        <div
          className={cn(
            'absolute left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2',
            layout.turnArea
          )}
        >
          {selectedCard && isSelectedCardPlayable && (
            <Button
              variant="primary"
              glow
              onClick={() => playCard(selectedCard)}
              className="px-6 py-1.5 text-sm whitespace-nowrap"
            >
              Play Card
            </Button>
          )}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            role="status"
            aria-live="assertive"
          >
            <div className="relative overflow-hidden px-4 py-2 rounded-lg text-gold-400 text-sm font-medium whitespace-nowrap" style={{
              background: 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(251,191,36,0.08))',
              border: '1px solid rgba(251,191,36,0.4)',
              boxShadow: '0 0 20px rgba(251,191,36,0.15)',
            }}>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gold-400/10 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
              <span className="relative">Your turn - select a card to play</span>
            </div>
          </motion.div>
        </div>
      )}

      {/* Tutorial hints */}
      {isTutorial && (
        <TutorialOverlay
          phase={phase}
          isMyTurn={isMyTurn}
          completedTricks={round?.completedTricks}
        />
      )}

      {/* Modals and announcements */}
      <GameOverlays
        showWykladana={showWykladana}
        wykladanaData={wykladanaData}
        onConfirmWykladana={confirmWykladana}
        showRoundResult={showRoundResult}
        lastRoundResult={lastRoundResult}
        players={gameState.players}
        onCloseRoundResult={() => setShowRoundResult(false)}
        showGameEnd={showGameEnd}
        winner={gameState.winner}
        scores={Object.fromEntries(
          Object.entries(scores).map(([id, s]) => [id, s.totalScore])
        )}
        currentPlayerId={playerId}
        gameStatistics={gameStatistics}
        onPlayAgain={() => {
          useGameStore.getState().reset();
        }}
        onLeaveRoom={leaveRoom}
        showLeaveModal={showLeaveModal}
        onConfirmLeave={() => {
          setShowLeaveModal(false);
          leaveGame();
        }}
        onCancelLeave={() => setShowLeaveModal(false)}
        passedAt100Notification={passedAt100Notification}
        onClearPassedAt100={() => setPassedAt100Notification(null)}
        threwNotification={threwNotification}
        onClearThrew={() => setThrewNotification(null)}
        pauseData={pauseData}
        onResume={resumeGame}
        marriageAnnouncement={lastMarriageDeclared
          ? `${gameState.players.find(p => p.id === lastMarriageDeclared.playerId)?.name || 'Player'} declared ${lastMarriageDeclared.suit} marriage`
          : null
        }
        trickWonAnnouncement={trickWonData
          ? `${gameState.players.find(p => p.id === trickWonData.winnerId)?.name || 'Player'} won the trick${trickWonData.wasTrumpWin ? ' with trump' : ''}`
          : null
        }
      />

    </div>
  );
}

'use client';

import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlayerHand } from './PlayerHand';
import { OpponentHand } from './OpponentHand';
import { TrickPile } from './TrickPile';
import { ScoreBoard } from './ScoreBoard';
import { BiddingPanel } from './BiddingPanel';
import { TalonDisplay, TalonDistributionPanel } from './TalonPanel';
import { PlayOrPassPanel } from './PlayOrPassPanel';
import { WykladanaModal } from './WykladanaModal';
import { RoundResultModal } from './RoundResultModal';
import { GameEndModal } from './GameEndModal';
import { LeaveGameModal } from './LeaveGameModal';
import { PassedAt100Announcement } from './PassedAt100Announcement';
import { ThrewAnnouncement } from './ThrewAnnouncement';
import { PauseOverlay } from './PauseOverlay';
import { useGameStore } from '@/stores/gameStore';
import { useRoomStore } from '@/stores/roomStore';
import { useSocket } from '@/hooks/useSocket';
import { useIsMobile } from '@/hooks/useIsMobile';
import { cn } from '@/lib/utils';
import type { Card as CardType } from '@tysiac/shared';

export function GameBoard() {
  const isMobile = useIsMobile();
  const { playerId } = useRoomStore();
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
  } = useGameStore();
  const { selectCard, setShowWykladana, setPassedAt100Notification, setThrewNotification } = useGameStore();
  const { setShowRoundResult, setShowGameEnd } = useGameStore();

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


  // Track talon confirmation state
  const [hasConfirmedTalon, setHasConfirmedTalon] = useState(false);

  // Track leave game modal
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  // Talon distribution state
  const [distributionTarget, setDistributionTarget] = useState<string | null>(null);
  const [distributionCards, setDistributionCards] = useState<Map<string, CardType>>(new Map());

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


  if (!gameState || !playerId) {
    return (
      <div className="flex items-center justify-center h-screen" role="status" aria-label="Loading game">
        <div className="text-white/80 flex items-center gap-3">
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading game...
        </div>
      </div>
    );
  }

  const { phase, round, myHand, talon, scores } = gameState;

  // Calculate opponent hand sizes
  const getOpponentHandSize = (opponentId: string) => {
    // During distribution, bid winner has 10 cards, others have 7
    if (phase === 'talonDistribution' && round?.bidWinner === opponentId) {
      return 10;
    }
    // After distribution, everyone should have 8 (if tricks started)
    if (phase === 'trickPlaying' && round) {
      // Count remaining cards based on completed tricks
      return 8 - round.completedTricks;
    }
    return 7;
  };

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ height: '100dvh' }}>
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-radial from-table-800/50 to-transparent" />

      {/* Leave game button - top left */}
      <div className="absolute top-[max(1rem,env(safe-area-inset-top))] left-4 z-30 flex gap-2">
        <button
          onClick={() => setShowLeaveModal(true)}
          className="px-2 sm:px-3 py-1.5 bg-table-800/80 hover:bg-table-700 border border-table-600 rounded-lg text-white/70 hover:text-white text-sm transition-colors"
        >
          <span className="sm:hidden">←</span>
          <span className="hidden sm:inline">← Leave</span>
        </button>
        {phase !== 'gameEnd' && !gameState.isPaused && (
          <button
            onClick={pauseGame}
            className="px-2 sm:px-3 py-1.5 bg-table-800/80 hover:bg-amber-700/50 border border-table-600 rounded-lg text-white/70 hover:text-amber-400 text-sm transition-colors"
            title="Pause game"
          >
            <span className="sm:hidden">||</span>
            <span className="hidden sm:inline">|| Pause</span>
          </button>
        )}
      </div>

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
        isMobile ? 'top-20 left-2' : 'top-24 left-8'
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
        isMobile ? 'top-20 right-2' : 'top-24 right-8'
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

      {/* Center area - trick pile / talon */}
      <div className="absolute inset-0 flex items-center justify-center">
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
        isMobile ? 'bottom-28' : 'bottom-32'
      )}>
        <AnimatePresence mode="wait">
          {/* Bidding panel */}
          {phase === 'bidding' && (
            <motion.div
              key="bidding"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <BiddingPanel
                validActions={validActions}
                currentBid={round?.finalBid || 100}
                onBid={bid}
                onPass={pass}
                isMyTurn={isMyTurn}
              />
            </motion.div>
          )}

          {/* Play or Pass decision */}
          {phase === 'playOrPassDecision' && (
            <motion.div
              key="playOrPass"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <PlayOrPassPanel
                onPlay={() => playOrPass('play')}
                onPass={() => playOrPass('pass')}
                isMyTurn={(isMyTurn || validActions.some(a => a.type === 'playOrPass')) && round?.bidWinner === playerId}
                bidAmount={round?.finalBid || 100}
                playerCount={playerCount}
              />
            </motion.div>
          )}

          {/* Talon distribution */}
          {phase === 'talonDistribution' &&
            round?.bidWinner === playerId &&
            gameState.cardsToDistribute && (
              <motion.div
                key="distribution"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <TalonDistributionPanel
                  otherPlayers={otherPlayers.slice(0, 2)}
                  selectedCards={distributionCards}
                  currentTarget={distributionTarget}
                  onSelectTarget={setDistributionTarget}
                  onDistribute={handleDistributeSubmit}
                />
              </motion.div>
            )}

        </AnimatePresence>
      </div>

      {/* Spectating indicator for dealer in 4-player mode */}
      {isSpectating && (
        <div className={cn(
          'absolute left-1/2 -translate-x-1/2 z-20',
          isMobile ? 'bottom-2' : 'bottom-4'
        )}>
          <div className="px-4 py-2 bg-table-800/90 border border-amber-500/50 rounded-lg text-center">
            <div className="text-amber-400 text-sm font-medium">
              You are the dealer — spectating this round
            </div>
          </div>
        </div>
      )}

      {/* Player's hand or Third active player (when spectating) */}
      <div className={cn(
        'absolute left-1/2 -translate-x-1/2 z-10',
        isSpectating
          ? (isMobile ? 'bottom-16' : 'bottom-20')
          : (isMobile ? 'bottom-2' : 'bottom-4')
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

      {/* Turn indicator */}
      {isMyTurn && phase === 'trickPlaying' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className={cn(
            'absolute left-1/2 -translate-x-1/2 z-20',
            isMobile ? 'bottom-36' : 'bottom-48'
          )}
          role="status"
          aria-live="assertive"
        >
          <div className="px-4 py-2 bg-gold-500/20 border border-gold-500/50 rounded-lg text-gold-400 text-sm font-medium">
            Your turn - select a card to play
          </div>
        </motion.div>
      )}

      {/* WYKLADANA celebration */}
      {showWykladana && wykladanaData && (
        <WykladanaModal
          playerName={wykladanaData.playerName}
          bid={wykladanaData.bid}
          marriagePoints={wykladanaData.marriagePoints}
          cards={wykladanaData.cards}
          onComplete={confirmWykladana}
        />
      )}

      {/* Round result modal */}
      {showRoundResult && lastRoundResult && (
        <RoundResultModal
          result={lastRoundResult}
          players={gameState.players}
          onClose={() => setShowRoundResult(false)}
        />
      )}

      {/* Game end modal */}
      {showGameEnd && gameState.winner && (
        <GameEndModal
          winnerId={gameState.winner}
          players={gameState.players}
          scores={Object.fromEntries(
            Object.entries(scores).map(([id, s]) => [id, s.totalScore])
          )}
          currentPlayerId={playerId}
          statistics={gameStatistics}
          onPlayAgain={startGame}
          onLeave={leaveRoom}
        />
      )}

      {/* Leave game confirmation modal */}
      {showLeaveModal && (
        <LeaveGameModal
          onConfirm={() => {
            setShowLeaveModal(false);
            leaveGame();
          }}
          onCancel={() => setShowLeaveModal(false)}
        />
      )}

      {/* Passed at 100 announcement */}
      <PassedAt100Announcement
        playerName={passedAt100Notification?.playerName || null}
        onComplete={() => setPassedAt100Notification(null)}
      />

      {/* Threw announcement (for bids > 100) */}
      <ThrewAnnouncement
        data={threwNotification}
        players={gameState.players}
        onComplete={() => setThrewNotification(null)}
      />

      {/* Pause overlay */}
      {(gameState.isPaused || pauseData) && pauseData && (
        <PauseOverlay
          pausedByName={pauseData.pausedByName}
          pausedAt={pauseData.pausedAt}
          onResume={resumeGame}
        />
      )}

    </div>
  );
}

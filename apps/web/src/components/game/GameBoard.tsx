'use client';

import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlayerHand, OpponentHand } from './PlayerHand';
import { TrickPile } from './TrickPile';
import { ScoreBoard } from './ScoreBoard';
import { BiddingPanel } from './BiddingPanel';
import { TalonDisplay, TalonDistributionPanel } from './TalonPanel';
import { MarriagePanel, DeclaredMarriages } from './MarriagePanel';
import { RoundResultModal, GameEndModal, LeaveGameModal } from './RoundResultModal';
import { useGameStore } from '@/stores/gameStore';
import { useRoomStore } from '@/stores/roomStore';
import { useSocket } from '@/hooks/useSocket';
import { cn } from '@/lib/utils';
import type { Card as CardType, Suit } from '@tysiac/shared';

// Hook to track screen size
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

const MARRIAGE_VALUES: Record<Suit, number> = {
  spades: 40,
  clubs: 60,
  diamonds: 80,
  hearts: 100,
};

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
  } = useGameStore();
  const { selectCard } = useGameStore();
  const { setShowRoundResult, setShowGameEnd } = useGameStore();

  const {
    bid,
    pass,
    playCard,
    declareMarriage,
    distributeTalon,
    confirmTalon,
    leaveRoom,
    leaveGame,
    startGame,
  } = useSocket();

  // Get current player info
  const myPlayer = gameState?.players.find((p) => p.id === playerId);
  const isSpectating = gameState?.isSpectating || false;
  const playerCount = gameState?.players.length || 3;

  // Order other players: left = next player (clockwise), right = previous player
  // In 4-player mode, there are 3 other players (left, top, right)
  const otherPlayers = useMemo(() => {
    if (!gameState || !playerId) return [];
    const myIndex = gameState.players.findIndex((p) => p.id === playerId);
    if (myIndex === -1) return [];

    if (gameState.players.length === 4) {
      // 4-player layout: left, top, right
      const leftPlayer = gameState.players[(myIndex + 1) % 4];
      const topPlayer = gameState.players[(myIndex + 2) % 4];
      const rightPlayer = gameState.players[(myIndex + 3) % 4];
      return [leftPlayer, topPlayer, rightPlayer];
    } else {
      // 3-player layout: left, right
      const leftPlayer = gameState.players[(myIndex + 1) % 3];
      const rightPlayer = gameState.players[(myIndex + 2) % 3];
      return [leftPlayer, rightPlayer];
    }
  }, [gameState, playerId]);

  // Marriage action check
  const marriageAction = validActions.find((a) => a.type === 'declareMarriage');
  const showMarriagePanel =
    marriageAction &&
    marriageAction.type === 'declareMarriage' &&
    gameState?.round?.currentTrick?.cards.length === 0;

  // Track talon confirmation state
  const [hasConfirmedTalon, setHasConfirmedTalon] = useState(false);

  // Track leave game modal
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  // Reset confirmation state when phase changes
  useEffect(() => {
    if (gameState?.phase !== 'talonReveal') {
      setHasConfirmedTalon(false);
    }
  }, [gameState?.phase]);

  // Get my declared marriages
  const myDeclaredMarriages = playerId
    ? gameState?.round?.declaredMarriages?.[playerId] || []
    : [];
  const myMarriagePoints = myDeclaredMarriages.reduce(
    (sum, suit) => sum + MARRIAGE_VALUES[suit],
    0
  );

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
    <div className="relative h-screen w-full overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-radial from-table-800/50 to-transparent" />

      {/* Leave game button - top left */}
      <div className="absolute top-4 left-4 z-30">
        <button
          onClick={() => setShowLeaveModal(true)}
          className="px-3 py-1.5 bg-table-800/80 hover:bg-table-700 border border-table-600 rounded-lg text-white/70 hover:text-white text-sm transition-colors"
        >
          ← Leave
        </button>
      </div>

      {/* Score board - top center */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
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

        {/* My marriages */}
        {round && myDeclaredMarriages.length > 0 && (
          <div className="mt-2 bg-table-900/80 backdrop-blur border border-table-600 rounded-xl p-2">
            <DeclaredMarriages
              marriages={myDeclaredMarriages}
              totalPoints={myMarriagePoints}
            />
          </div>
        )}
      </div>

      {/* Spectating indicator */}
      {isSpectating && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-4 right-4 z-30 px-4 py-2 bg-purple-500/20 border border-purple-500/50 rounded-lg"
        >
          <span className="text-purple-400 font-medium">Spectating this round</span>
          <p className="text-purple-300/70 text-xs mt-1">You are the dealer and sit out this round</p>
        </motion.div>
      )}

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

      {/* Top opponent (only in 4-player mode) */}
      {playerCount === 4 && otherPlayers[1] && (
        <div className={cn(
          'absolute z-10 left-1/2 -translate-x-1/2',
          isMobile ? 'top-32' : 'top-36'
        )}>
          <OpponentHand
            cardCount={getOpponentHandSize(otherPlayers[1].id)}
            position="left"
            playerName={otherPlayers[1].name}
            isCurrentTurn={
              round?.currentTrick?.currentPlayer === otherPlayers[1].id
            }
          />
        </div>
      )}

      <div className={cn(
        'absolute z-10',
        isMobile ? 'top-20 right-2' : 'top-24 right-8'
      )}>
        {/* In 4-player mode, right player is otherPlayers[2], in 3-player it's otherPlayers[1] */}
        {(playerCount === 4 ? otherPlayers[2] : otherPlayers[1]) && (
          <OpponentHand
            cardCount={getOpponentHandSize(playerCount === 4 ? otherPlayers[2].id : otherPlayers[1].id)}
            position="right"
            playerName={playerCount === 4 ? otherPlayers[2].name : otherPlayers[1].name}
            isCurrentTurn={
              round?.currentTrick?.currentPlayer === (playerCount === 4 ? otherPlayers[2].id : otherPlayers[1].id)
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

          {/* Talon reveal */}
          {phase === 'talonReveal' && talon && (
            <motion.div
              key="talon-reveal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4"
            >
              <TalonDisplay talon={talon} isRevealed={true} />
              {!hasConfirmedTalon && (
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
              {hasConfirmedTalon && (
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
                players={gameState.players}
                currentPlayerId={playerId}
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
                  myHand={myHand}
                  otherPlayers={otherPlayers}
                  onDistribute={distributeTalon}
                />
              </motion.div>
            )}

          {/* Marriage declaration */}
          {showMarriagePanel && marriageAction.type === 'declareMarriage' && (
            <motion.div
              key="marriage"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <MarriagePanel
                availableSuits={marriageAction.suits}
                onDeclare={declareMarriage}
                onSkip={() => {
                  // Play the selected card if any, or first valid card
                  const playAction = validActions.find(
                    (a) => a.type === 'playCard'
                  );
                  if (
                    playAction &&
                    playAction.type === 'playCard' &&
                    selectedCard
                  ) {
                    playCard(selectedCard);
                  }
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Player's hand */}
      <div className={cn(
        'absolute left-1/2 -translate-x-1/2 z-10',
        isMobile ? 'bottom-2' : 'bottom-4'
      )}>
        <PlayerHand
          cards={myHand}
          validActions={validActions}
          selectedCard={selectedCard}
          onSelectCard={selectCard}
          onPlayCard={playCard}
          isMyTurn={isMyTurn && phase === 'trickPlaying'}
        />
      </div>

      {/* Turn indicator */}
      {isMyTurn && phase === 'trickPlaying' && !showMarriagePanel && (
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
          <div className="px-4 py-2 bg-gold-500/20 border border-gold-500/50 rounded-full text-gold-400 text-sm font-medium">
            Your turn - select a card to play
          </div>
        </motion.div>
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
    </div>
  );
}

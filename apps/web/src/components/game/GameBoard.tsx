'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlayerHand, OpponentHand } from './PlayerHand';
import { TrickPile } from './TrickPile';
import { ScoreBoard } from './ScoreBoard';
import { BiddingPanel } from './BiddingPanel';
import { TalonDisplay, TalonDistributionPanel } from './TalonPanel';
import { MarriagePanel, DeclaredMarriages } from './MarriagePanel';
import { RoundResultModal, GameEndModal } from './RoundResultModal';
import { useGameStore } from '@/stores/gameStore';
import { useRoomStore } from '@/stores/roomStore';
import { useSocket } from '@/hooks/useSocket';
import { cn } from '@/lib/utils';
import type { Card as CardType, Suit } from '@tysiac/shared';

const MARRIAGE_VALUES: Record<Suit, number> = {
  spades: 40,
  clubs: 60,
  diamonds: 80,
  hearts: 100,
};

export function GameBoard() {
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
    leaveRoom,
    startGame,
  } = useSocket();

  // Get current player info
  const myPlayer = gameState?.players.find((p) => p.id === playerId);
  // Order other players: left = next player (clockwise), right = previous player
  const otherPlayers = useMemo(() => {
    if (!gameState || !playerId) return [];
    const myIndex = gameState.players.findIndex((p) => p.id === playerId);
    if (myIndex === -1) return [];
    // Player to the left plays after me (clockwise), player to the right plays before me
    const leftPlayer = gameState.players[(myIndex + 1) % 3];
    const rightPlayer = gameState.players[(myIndex + 2) % 3];
    return [leftPlayer, rightPlayer];
  }, [gameState, playerId]);

  // Marriage action check
  const marriageAction = validActions.find((a) => a.type === 'declareMarriage');
  const showMarriagePanel =
    marriageAction &&
    marriageAction.type === 'declareMarriage' &&
    gameState?.round?.currentTrick?.cards.length === 0;

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
      <div className="flex items-center justify-center h-screen">
        <div className="text-white/60">Loading game...</div>
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

      {/* Score board - top center */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
        <ScoreBoard
          players={gameState.players}
          scores={scores}
          currentPlayerId={playerId}
          bidWinner={round?.bidWinner}
          finalBid={round?.finalBid}
          trumpSuit={round?.trumpSuit}
        />
      </div>

      {/* Round info - top left */}
      {round && (
        <div className="absolute top-4 left-4 z-20">
          <div className="bg-table-900/80 backdrop-blur border border-table-600 rounded-xl p-3">
            <div className="text-sm text-white/60">Round {round.roundNumber}</div>
            <div className="text-xs text-white/40 mt-1">
              Dealer:{' '}
              {gameState.players.find((p) => p.id === round.dealer)?.name}
            </div>
            {phase === 'trickPlaying' && (
              <div className="text-xs text-white/40">
                Trick {round.completedTricks + 1} of 7
              </div>
            )}
          </div>

          {/* My marriages */}
          {myDeclaredMarriages.length > 0 && (
            <div className="mt-2 bg-table-900/80 backdrop-blur border border-table-600 rounded-xl p-2">
              <DeclaredMarriages
                marriages={myDeclaredMarriages}
                totalPoints={myMarriagePoints}
              />
            </div>
          )}
        </div>
      )}

      {/* Opponents */}
      <div className="absolute top-24 left-8 z-10">
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

      <div className="absolute top-24 right-8 z-10">
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

          {/* Talon reveal */}
          {phase === 'talonReveal' && talon && (
            <motion.div
              key="talon-reveal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <TalonDisplay talon={talon} isRevealed={true} />
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
      <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-30">
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
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
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
          className="absolute bottom-48 left-1/2 -translate-x-1/2 z-20"
        >
          <div className="px-4 py-2 bg-gold-500/20 border border-gold-500/50 rounded-full text-gold-400 text-sm">
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
    </div>
  );
}

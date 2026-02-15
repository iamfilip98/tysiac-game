import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as Haptics from 'expo-haptics';

import { PlayerHand, OpponentHand } from './PlayerHand';
import { TrickPile } from './TrickPile';
import { ScoreBoard } from './ScoreBoard';
import { BiddingPanel } from './BiddingPanel';
import { TalonDisplay, TalonDistributionPanel } from './TalonPanel';
import { PlayOrPassPanel } from './PlayOrPassPanel';
import { Button } from '@/components/ui/Button';

import { useGameStore } from '@/stores/gameStore';
import { useRoomStore } from '@/stores/roomStore';
import { useSocket } from '@/hooks/useSocket';
import type { Card as CardType } from '@tysiac/shared';
import { colors, spacing, fontSize, fontWeight, borderRadius } from '@/constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export function GameBoard() {
  const insets = useSafeAreaInsets();
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

  // Talon confirmation state
  const [hasConfirmedTalon, setHasConfirmedTalon] = useState(false);

  // Distribution state
  const [distributionTarget, setDistributionTarget] = useState<string | null>(null);
  const [distributionCards, setDistributionCards] = useState<Map<string, CardType>>(new Map());

  // Leave modal state
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  // Get current player info
  const myPlayer = gameState?.players.find((p) => p.id === playerId);
  const isSpectating = gameState?.isSpectating || false;
  const playerCount = gameState?.players.length || 3;

  // Order other players
  const otherPlayers = useMemo(() => {
    if (!gameState || !playerId) return [];
    const myIndex = gameState.players.findIndex((p) => p.id === playerId);
    if (myIndex === -1) return [];

    if (gameState.players.length === 4) {
      const dealerId = gameState.round?.dealer;
      const otherActive: typeof gameState.players = [];
      for (let i = 1; i <= 3; i++) {
        const player = gameState.players[(myIndex + i) % 4];
        if (player.id !== dealerId) {
          otherActive.push(player);
        }
      }
      return otherActive;
    } else {
      const leftPlayer = gameState.players[(myIndex + 1) % 3];
      const rightPlayer = gameState.players[(myIndex + 2) % 3];
      return [leftPlayer, rightPlayer];
    }
  }, [gameState, playerId]);

  // Reset states on phase change
  useEffect(() => {
    if (gameState?.phase !== 'talonReveal') {
      setHasConfirmedTalon(false);
    }
  }, [gameState?.phase]);

  useEffect(() => {
    if (gameState?.phase !== 'talonDistribution') {
      setDistributionTarget(null);
      setDistributionCards(new Map());
    }
  }, [gameState?.phase]);

  // Haptic feedback on turn
  useEffect(() => {
    if (isMyTurn) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [isMyTurn]);

  // Distribution handlers
  const handleDistributionCardSelect = (card: CardType) => {
    if (!distributionTarget) return;

    const newSelected = new Map(distributionCards);
    newSelected.forEach((selectedCard, pId) => {
      if (selectedCard.suit === card.suit && selectedCard.rank === card.rank) {
        newSelected.delete(pId);
      }
    });

    newSelected.set(distributionTarget, card);
    setDistributionCards(newSelected);

    const nextPlayer = otherPlayers.slice(0, 2).find((p) => !newSelected.has(p.id));
    setDistributionTarget(nextPlayer?.id || null);
  };

  const handleDistributeSubmit = () => {
    const distribution: { playerId: string; card: CardType }[] = [];
    distributionCards.forEach((card, pId) => {
      distribution.push({ playerId: pId, card });
    });
    distributeTalon(distribution);
  };

  // Auto-confirm talon for spectators
  useEffect(() => {
    if (isSpectating && gameState?.phase === 'talonReveal' && !hasConfirmedTalon) {
      setHasConfirmedTalon(true);
      confirmTalon();
    }
  }, [isSpectating, gameState?.phase, hasConfirmedTalon, confirmTalon]);

  // Calculate opponent hand sizes
  const getOpponentHandSize = (opponentId: string) => {
    const phase = gameState?.phase;
    const round = gameState?.round;
    if (phase === 'talonDistribution' && round?.bidWinner === opponentId) {
      return 10;
    }
    if (phase === 'trickPlaying' && round) {
      return 8 - round.completedTricks;
    }
    return 7;
  };

  if (!gameState || !playerId) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <Text style={styles.loadingText}>Loading game...</Text>
      </View>
    );
  }

  const { phase, round, myHand, talon, scores } = gameState;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      {/* Top bar - Leave button and Score */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.leaveButton}
          onPress={() => setShowLeaveModal(true)}
        >
          <Text style={styles.leaveButtonText}>{'\u2190'}</Text>
        </TouchableOpacity>

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

        {room?.isPrivate && phase !== 'gameEnd' && !gameState.isPaused && (
          <TouchableOpacity
            style={styles.pauseButton}
            onPress={pauseGame}
          >
            <Text style={styles.pauseButtonText}>||</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Opponents */}
      <View style={styles.opponentLeft}>
        {otherPlayers[0] && (
          <OpponentHand
            cardCount={getOpponentHandSize(otherPlayers[0].id)}
            position="left"
            playerName={otherPlayers[0].name}
            isCurrentTurn={round?.currentTrick?.currentPlayer === otherPlayers[0].id}
          />
        )}
      </View>

      <View style={styles.opponentRight}>
        {otherPlayers[1] && (
          <OpponentHand
            cardCount={getOpponentHandSize(otherPlayers[1].id)}
            position="right"
            playerName={otherPlayers[1].name}
            isCurrentTurn={round?.currentTrick?.currentPlayer === otherPlayers[1].id}
          />
        )}
      </View>

      {/* Center area */}
      <View style={styles.centerArea}>
        {(phase === 'dealing' || phase === 'bidding') && (
          <TalonDisplay talon={[]} isRevealed={false} />
        )}

        {phase === 'talonReveal' && talon && (
          <View style={styles.talonContainer}>
            <TalonDisplay talon={talon} isRevealed={true} />
            {!hasConfirmedTalon && (
              <Button
                variant="primary"
                onPress={() => {
                  setHasConfirmedTalon(true);
                  confirmTalon();
                }}
                glow
                style={styles.continueButton}
              >
                Continue
              </Button>
            )}
            {hasConfirmedTalon && (
              <Text style={styles.waitingForOthers}>Waiting for other players...</Text>
            )}
          </View>
        )}

        {phase === 'trickPlaying' && round?.currentTrick && (
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
          />
        )}
      </View>

      {/* Action panels */}
      <View style={styles.actionArea}>
        {phase === 'bidding' && (
          <BiddingPanel
            validActions={validActions}
            currentBid={round?.finalBid || 100}
            onBid={bid}
            onPass={pass}
            isMyTurn={isMyTurn}
          />
        )}

        {phase === 'playOrPassDecision' && (
          <PlayOrPassPanel
            onPlay={() => playOrPass('play')}
            onPass={() => playOrPass('pass')}
            isMyTurn={(isMyTurn || validActions.some(a => a.type === 'playOrPass')) && round?.bidWinner === playerId}
            bidAmount={round?.finalBid || 100}
            playerCount={playerCount}
          />
        )}

        {phase === 'talonDistribution' &&
          round?.bidWinner === playerId &&
          gameState.cardsToDistribute && (
            <TalonDistributionPanel
              otherPlayers={otherPlayers.slice(0, 2)}
              selectedCards={distributionCards}
              currentTarget={distributionTarget}
              onSelectTarget={setDistributionTarget}
              onDistribute={handleDistributeSubmit}
            />
          )}
      </View>

      {/* Spectating indicator */}
      {isSpectating && (
        <View style={styles.spectatingIndicator}>
          <Text style={styles.spectatingText}>
            You are the dealer — spectating this round
          </Text>
        </View>
      )}

      {/* Player's hand */}
      <View style={[styles.handArea, { paddingBottom: insets.bottom + spacing.sm }]}>
        {isSpectating ? (
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
      </View>

      {/* Turn indicator */}
      {isMyTurn && phase === 'trickPlaying' && (
        <View
          
          style={styles.turnIndicator}
        >
          <Text style={styles.turnIndicatorText}>Your turn - select a card to play</Text>
        </View>
      )}

      {/* Leave confirmation modal */}
      {showLeaveModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Leave Game?</Text>
            <Text style={styles.modalText}>
              You will be replaced by an AI player if you leave.
            </Text>
            <View style={styles.modalButtons}>
              <Button
                variant="ghost"
                onPress={() => setShowLeaveModal(false)}
                style={styles.modalButton}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onPress={() => {
                  setShowLeaveModal(false);
                  leaveGame();
                }}
                style={styles.modalButton}
              >
                Leave
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* Pause overlay */}
      {pauseData && (
        <View style={styles.pauseOverlay}>
          <View style={styles.pauseModal}>
            <Text style={styles.pauseTitle}>Game Paused</Text>
            <Text style={styles.pauseText}>
              Paused by {pauseData.pausedByName}
            </Text>
            <Button
              variant="primary"
              onPress={resumeGame}
              glow
              style={styles.resumeButton}
            >
              Resume Game
            </Button>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.table[950],
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.table[950],
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: fontSize.md,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    zIndex: 20,
  },
  leaveButton: {
    position: 'absolute',
    left: spacing.md,
    top: spacing.sm,
    padding: spacing.sm,
    minWidth: 44,
    alignItems: 'center',
    backgroundColor: 'rgba(22, 101, 52, 0.8)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(22, 101, 52, 0.6)',
  },
  leaveButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: fontSize.md,
  },
  pauseButton: {
    position: 'absolute',
    right: spacing.md,
    top: spacing.sm,
    padding: spacing.sm,
    minWidth: 44,
    alignItems: 'center',
    backgroundColor: 'rgba(22, 101, 52, 0.8)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(22, 101, 52, 0.6)',
  },
  pauseButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  opponentLeft: {
    position: 'absolute',
    top: 100,
    left: spacing.sm,
    zIndex: 10,
  },
  opponentRight: {
    position: 'absolute',
    top: 100,
    right: spacing.sm,
    zIndex: 10,
  },
  centerArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  talonContainer: {
    alignItems: 'center',
    gap: spacing.md,
  },
  continueButton: {
    marginTop: spacing.md,
  },
  waitingForOthers: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
  },
  actionArea: {
    position: 'absolute',
    bottom: 160,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 30,
  },
  spectatingIndicator: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  spectatingText: {
    color: colors.gold[400],
    fontSize: fontSize.sm,
    backgroundColor: 'rgba(20, 83, 45, 0.9)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    overflow: 'hidden',
  },
  handArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  turnIndicator: {
    position: 'absolute',
    bottom: 180,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  turnIndicatorText: {
    color: colors.gold[400],
    fontSize: fontSize.sm,
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    overflow: 'hidden',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    backgroundColor: colors.table[900],
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    width: 300,
    borderWidth: 1,
    borderColor: colors.table[700],
  },
  modalTitle: {
    color: colors.white,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  modalText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalButton: {
    flex: 1,
  },
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  pauseModal: {
    backgroundColor: colors.table[900],
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gold[500] + '50',
  },
  pauseTitle: {
    color: colors.gold[400],
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.sm,
  },
  pauseText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: fontSize.md,
    marginBottom: spacing.lg,
  },
  resumeButton: {
    minWidth: 200,
  },
});

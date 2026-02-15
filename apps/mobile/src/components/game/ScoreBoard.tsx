import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import type { Suit } from '@tysiac/shared';
import { getSuitSymbol, truncateName } from '@/lib/utils';
import { colors, borderRadius, fontSize, fontWeight, spacing } from '@/constants/theme';

interface ScoreBoardProps {
  players: { id: string; name: string; isAI: boolean }[];
  scores: Record<
    string,
    { totalScore: number; roundScores: number[]; isOnBarrel: boolean }
  >;
  currentPlayerId: string;
  bidWinner?: string | null;
  finalBid?: number;
  trumpSuit?: Suit | null;
  dealerId?: string | null;
  roundNumber?: number;
  completedTricks?: number;
  phase?: string;
}

export function ScoreBoard({
  players,
  scores,
  currentPlayerId,
  bidWinner,
  finalBid,
  trumpSuit,
  dealerId,
  roundNumber,
  completedTricks,
  phase,
}: ScoreBoardProps) {
  const isFourPlayer = players.length === 4;

  return (
    <View style={[styles.container, isFourPlayer && styles.containerCompact]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Scores</Text>
        {trumpSuit && (
          <View style={styles.trumpContainer}>
            <Text style={styles.trumpLabel}>Trump:</Text>
            <Text
              style={[
                styles.trumpSuit,
                {
                  color:
                    trumpSuit === 'hearts' || trumpSuit === 'diamonds'
                      ? colors.card.red
                      : colors.white,
                },
              ]}
            >
              {getSuitSymbol(trumpSuit)}
            </Text>
          </View>
        )}
      </View>

      {/* Players */}
      <View style={styles.playersList}>
        {players.map((player) => {
          const score = scores[player.id];
          const isMe = player.id === currentPlayerId;
          const isBidder = bidWinner === player.id;
          const isDealer = dealerId === player.id;

          return (
            <View
              key={player.id}
              style={[
                styles.playerRow,
                isFourPlayer && styles.playerRowCompact,
                isMe && styles.playerRowMe,
                isBidder && !isMe && styles.playerRowBidder,
              ]}
            >
              <View style={styles.playerInfo}>
                {/* Dealer indicator */}
                {isDealer && <Text style={styles.dealerIcon}>8</Text>}

                {/* Player name */}
                <Text
                  style={[styles.playerName, isMe && styles.playerNameMe]}
                  numberOfLines={1}
                >
                  {truncateName(player.name)}
                  {player.isAI && (
                    <Text style={styles.aiTag}> (AI)</Text>
                  )}
                </Text>

                {/* Bid indicator */}
                {isBidder && finalBid && (
                  <View style={styles.bidBadge}>
                    <Text style={styles.bidBadgeText}>{finalBid}</Text>
                  </View>
                )}
              </View>

              {/* Score */}
              <View style={styles.scoreContainer}>
                {score?.isOnBarrel && (
                  <Text style={styles.barrelIcon}>{'\uD83D\uDEE2\uFE0F'}</Text>
                )}
                {score?.totalScore === 410 && (
                  <Text style={styles.grunwaldIcon}>{'\uD83C\uDFF0'}</Text>
                )}
                <Text
                  style={[
                    styles.score,
                    score?.totalScore >= 800 && styles.scoreBarrel,
                    score?.totalScore < 0 && styles.scoreNegative,
                  ]}
                >
                  {score?.totalScore ?? 0}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Round info */}
      {roundNumber && (
        <View style={[styles.roundInfo, isFourPlayer && styles.roundInfoCompact]}>
          <Text style={styles.roundText}>Round {roundNumber}</Text>
          {phase === 'trickPlaying' && completedTricks !== undefined && (
            <>
              <Text style={styles.roundDivider}>{'\u2022'}</Text>
              <Text style={styles.roundText}>Trick {completedTricks + 1}/8</Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}

// Inline score component
interface InlineScoreProps {
  score: number;
  isOnBarrel?: boolean;
}

export function InlineScore({ score, isOnBarrel }: InlineScoreProps) {
  return (
    <Text
      style={[
        styles.inlineScore,
        score >= 800 && styles.scoreBarrel,
        score < 0 && styles.scoreNegative,
        score >= 0 && score < 800 && styles.scorePositive,
      ]}
    >
      {score}
      {isOnBarrel && ' \uD83D\uDEE2\uFE0F'}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(20, 83, 45, 0.9)',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(22, 101, 52, 0.6)',
    padding: spacing.md,
    width: 220,
  },
  containerCompact: {
    padding: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(22, 101, 52, 0.6)',
  },
  headerTitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  trumpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trumpLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: fontSize.xs,
  },
  trumpSuit: {
    fontSize: fontSize.md,
  },
  playersList: {
    gap: spacing.xs,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  playerRowCompact: {
    padding: spacing.xs,
  },
  playerRowMe: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  playerRowBidder: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  dealerIcon: {
    fontSize: fontSize.sm,
  },
  playerName: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  playerNameMe: {
    color: colors.gold[400],
  },
  aiTag: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: fontSize.xs,
  },
  bidBadge: {
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  bidBadgeText: {
    color: colors.gold[400],
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  barrelIcon: {
    fontSize: fontSize.xs,
  },
  grunwaldIcon: {
    fontSize: fontSize.xs,
  },
  score: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    fontFamily: 'monospace',
    minWidth: 40,
    textAlign: 'right',
  },
  scoreBarrel: {
    color: colors.gold[400],
  },
  scoreNegative: {
    color: colors.status.error,
  },
  scorePositive: {
    color: colors.status.success,
  },
  roundInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(22, 101, 52, 0.6)',
  },
  roundInfoCompact: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
  },
  roundText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: fontSize.xs,
  },
  roundDivider: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: fontSize.xs,
  },
  inlineScore: {
    fontFamily: 'monospace',
    fontWeight: fontWeight.medium,
  },
});

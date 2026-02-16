import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import type { Card as CardType } from '@tysiac/shared';
import { getSuitSymbol, getSuitColor } from '@/lib/utils';
import { colors, borderRadius, fontSize, fontWeight, shadows, cardDimensions } from '@/constants/theme';

type CardSize = 'sm' | 'md' | 'lg';

interface CardProps {
  card: CardType;
  isSelected?: boolean;
  isPlayable?: boolean;
  isFaceDown?: boolean;
  isMarriageCard?: boolean;
  size?: CardSize;
  onPress?: () => void;
  style?: ViewStyle;
  animationDelay?: number;
}

function CardBack({ dimensions, style }: { dimensions: { width: number; height: number }; style?: ViewStyle }) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 3500,
        useNativeDriver: true,
      })
    ).start();
  }, [shimmerAnim]);

  // Shimmer translates from left to right across the card
  const shimmerTranslateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-dimensions.width * 1.5, dimensions.width * 1.5],
  });

  return (
    <View style={[styles.cardBack, dimensions, style]}>
      <LinearGradient
        colors={['#2c5282', '#1a365d', '#1e3a5f']}
        style={styles.cardBackGradient}
      >
        <View style={styles.cardBackPattern}>
          <View style={styles.cardBackInner} />
        </View>
      </LinearGradient>
      {/* Gold/white shimmer sweep */}
      <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderRadius: borderRadius.lg }]}>
        <Animated.View
          style={{
            ...StyleSheet.absoluteFillObject,
            transform: [{ translateX: shimmerTranslateX }],
          }}
        >
          <LinearGradient
            colors={[
              'transparent',
              'rgba(212, 175, 55, 0.15)',
              'rgba(255, 255, 255, 0.25)',
              'rgba(212, 175, 55, 0.15)',
              'transparent',
            ]}
            locations={[0, 0.35, 0.5, 0.65, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.3 }}
            style={{ width: dimensions.width * 1.5, height: '100%' }}
          />
        </Animated.View>
      </View>
    </View>
  );
}

export function Card({
  card,
  isSelected = false,
  isPlayable = true,
  isFaceDown = false,
  isMarriageCard = false,
  size = 'md',
  onPress,
  style,
}: CardProps) {
  const suitSymbol = getSuitSymbol(card.suit);
  const cardColor = getSuitColor(card.suit);
  const dimensions = cardDimensions[size];

  const handlePress = () => {
    if (isPlayable && onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  };

  if (isFaceDown) {
    return (
      <CardBack dimensions={dimensions} style={style} />
    );
  }

  return (
    <View style={[style]}>
      {isMarriageCard && (
        <View
          style={[
            styles.marriageGlow,
            dimensions,
            shadows.glow(colors.gold[400]),
          ]}
        />
      )}

      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={isPlayable ? 0.8 : 1}
        disabled={!isPlayable}
        style={[
          styles.card,
          dimensions,
          !isPlayable && styles.cardDisabled,
          isPlayable && styles.cardPlayable,
          isSelected && styles.cardSelected,
          isSelected && { transform: [{ translateY: -16 }] },
        ]}
      >
        {isMarriageCard && (
          <LinearGradient
            colors={[
              'rgba(212, 175, 55, 0.9)',
              'rgba(245, 231, 163, 0.9)',
              'rgba(212, 175, 55, 0.9)',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.marriageOverlay}
          />
        )}

        <View style={styles.cardContent}>
          <View style={styles.cornerTopLeft}>
            <Text
              style={[
                styles.cornerRank,
                { color: cardColor === 'red' ? colors.card.red : colors.card.black },
              ]}
            >
              {card.rank}
            </Text>
            <Text
              style={[
                styles.cornerSuit,
                { color: cardColor === 'red' ? colors.card.red : colors.card.black },
              ]}
            >
              {suitSymbol}
            </Text>
          </View>

          <View style={styles.center}>
            <Text
              style={[
                styles.centerRank,
                { color: cardColor === 'red' ? colors.card.red : colors.card.black },
                size === 'sm' && styles.centerRankSmall,
              ]}
            >
              {card.rank}
            </Text>
            <Text
              style={[
                styles.centerSuit,
                { color: cardColor === 'red' ? colors.card.red : colors.card.black },
                size === 'sm' && styles.centerSuitSmall,
              ]}
            >
              {suitSymbol}
            </Text>
          </View>

          <View style={styles.cornerBottomRight}>
            <Text
              style={[
                styles.cornerRank,
                { color: cardColor === 'red' ? colors.card.red : colors.card.black },
              ]}
            >
              {card.rank}
            </Text>
            <Text
              style={[
                styles.cornerSuit,
                { color: cardColor === 'red' ? colors.card.red : colors.card.black },
              ]}
            >
              {suitSymbol}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

export function CardPlaceholder({ size = 'md', style }: { size?: CardSize; style?: ViewStyle }) {
  const dimensions = cardDimensions[size];

  return (
    <View
      style={[
        styles.placeholder,
        dimensions,
        style,
      ]}
    />
  );
}

export function MiniCard({ card, style }: { card: CardType; style?: ViewStyle }) {
  const suitSymbol = getSuitSymbol(card.suit);
  const cardColor = getSuitColor(card.suit);

  return (
    <Text
      style={[
        styles.miniCard,
        { color: cardColor === 'red' ? colors.card.red : colors.white },
        style,
      ]}
    >
      {card.rank}{suitSymbol}
    </Text>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card.white,
    borderRadius: borderRadius.lg,
    ...shadows.card,
    overflow: 'hidden',
  },
  cardPlayable: {
    borderWidth: 2,
    borderColor: colors.status.success,
  },
  cardDisabled: {
    opacity: 0.5,
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: colors.gold[400],
    ...shadows.glow(colors.gold[400]),
  },
  cardContent: {
    flex: 1,
    padding: 4,
  },
  cornerTopLeft: {
    position: 'absolute',
    top: 4,
    left: 6,
    alignItems: 'center',
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: 4,
    right: 6,
    alignItems: 'center',
    transform: [{ rotate: '180deg' }],
  },
  cornerRank: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    lineHeight: fontSize.sm + 2,
  },
  cornerSuit: {
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs + 2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerRank: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  centerRankSmall: {
    fontSize: fontSize.lg,
  },
  centerSuit: {
    fontSize: fontSize.xxxl,
    marginTop: -4,
  },
  centerSuitSmall: {
    fontSize: fontSize.xxl,
  },
  cardBack: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.card,
  },
  cardBackGradient: {
    flex: 1,
    padding: 4,
  },
  cardBackPattern: {
    flex: 1,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBackInner: {
    width: '60%',
    height: '60%',
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  marriageGlow: {
    position: 'absolute',
    borderRadius: borderRadius.lg,
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
  },
  marriageOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: borderRadius.lg - 2,
  },
  placeholder: {
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  miniCard: {
    fontFamily: 'monospace',
    fontSize: fontSize.sm,
  },
});

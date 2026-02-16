import type { Meta, StoryObj } from '@storybook/react';
import { TrickPile } from '@/components/game/TrickPile';
import { FeltDecorator } from './decorators';
import type { Card as CardType, Suit } from '@tysiac/shared';

const meta: Meta<typeof TrickPile> = {
  title: 'Game/TrickPile',
  component: TrickPile,
  decorators: [(Story) => <FeltDecorator><Story /></FeltDecorator>],
};

export default meta;
type Story = StoryObj<typeof TrickPile>;

const players = [
  { id: 'p1', name: 'You', seatIndex: 0 },
  { id: 'p2', name: 'Alice', seatIndex: 1 },
  { id: 'p3', name: 'Bob', seatIndex: 2 },
];

export const Empty: Story = {
  args: {
    cards: [],
    players,
    currentPlayerId: 'p1',
  },
};

export const OneCard: Story = {
  args: {
    cards: [{ playerId: 'p2', card: { suit: 'hearts', rank: 'A' } }],
    players,
    currentPlayerId: 'p1',
  },
};

export const TwoCards: Story = {
  args: {
    cards: [
      { playerId: 'p2', card: { suit: 'hearts', rank: 'A' } },
      { playerId: 'p3', card: { suit: 'hearts', rank: 'K' } },
    ],
    players,
    currentPlayerId: 'p1',
  },
};

export const FullTrick: Story = {
  args: {
    cards: [
      { playerId: 'p2', card: { suit: 'hearts', rank: 'A' } },
      { playerId: 'p3', card: { suit: 'hearts', rank: 'K' } },
      { playerId: 'p1', card: { suit: 'hearts', rank: '10' } },
    ],
    players,
    currentPlayerId: 'p1',
  },
};

export const WithTrumpSuit: Story = {
  args: {
    cards: [
      { playerId: 'p2', card: { suit: 'diamonds', rank: 'J' } },
      { playerId: 'p3', card: { suit: 'hearts', rank: 'Q' } },
      { playerId: 'p1', card: { suit: 'hearts', rank: 'A' } },
    ],
    players,
    currentPlayerId: 'p1',
    trumpSuit: 'hearts' as Suit,
  },
};

export const WithMarriage: Story = {
  args: {
    cards: [
      { playerId: 'p1', card: { suit: 'hearts', rank: 'Q' } },
    ],
    players,
    currentPlayerId: 'p1',
    marriageCard: { suit: 'hearts' as Suit },
  },
};

export const Spectating: Story = {
  args: {
    cards: [
      { playerId: 'p1', card: { suit: 'clubs', rank: 'A' } },
      { playerId: 'p2', card: { suit: 'clubs', rank: '10' } },
      { playerId: 'p3', card: { suit: 'clubs', rank: 'K' } },
    ],
    players,
    currentPlayerId: 'p4',
    isSpectating: true,
  },
};

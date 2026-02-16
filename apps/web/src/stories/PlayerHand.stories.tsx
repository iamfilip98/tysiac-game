import type { Meta, StoryObj } from '@storybook/react';
import { PlayerHand } from '@/components/game/PlayerHand';
import { FeltDecorator } from './decorators';
import type { Card as CardType, ValidAction, Suit } from '@tysiac/shared';

const meta: Meta<typeof PlayerHand> = {
  title: 'Game/PlayerHand',
  component: PlayerHand,
  decorators: [(Story) => <FeltDecorator><Story /></FeltDecorator>],
};

export default meta;
type Story = StoryObj<typeof PlayerHand>;

const sampleHand: CardType[] = [
  { suit: 'hearts', rank: 'A' },
  { suit: 'hearts', rank: 'K' },
  { suit: 'hearts', rank: 'Q' },
  { suit: 'diamonds', rank: '10' },
  { suit: 'clubs', rank: 'A' },
  { suit: 'clubs', rank: 'J' },
  { suit: 'spades', rank: 'K' },
];

const fullHand: CardType[] = [
  { suit: 'hearts', rank: 'A' },
  { suit: 'hearts', rank: 'K' },
  { suit: 'hearts', rank: 'Q' },
  { suit: 'diamonds', rank: '10' },
  { suit: 'diamonds', rank: 'K' },
  { suit: 'clubs', rank: 'A' },
  { suit: 'clubs', rank: 'J' },
  { suit: 'spades', rank: '9' },
];

const playAction: ValidAction = {
  type: 'playCard',
  validCards: [
    { suit: 'hearts', rank: 'A' },
    { suit: 'hearts', rank: 'K' },
    { suit: 'hearts', rank: 'Q' },
  ],
};

export const Default: Story = {
  args: {
    cards: sampleHand,
    validActions: [],
    selectedCard: null,
    onSelectCard: () => {},
    onPlayCard: () => {},
    isMyTurn: false,
    phase: 'trickPlaying',
  },
};

export const MyTurnWithPlayable: Story = {
  args: {
    cards: sampleHand,
    validActions: [playAction],
    selectedCard: null,
    onSelectCard: () => {},
    onPlayCard: () => {},
    isMyTurn: true,
    phase: 'trickPlaying',
  },
};

export const WithSelectedCard: Story = {
  args: {
    cards: sampleHand,
    validActions: [playAction],
    selectedCard: { suit: 'hearts', rank: 'A' },
    onSelectCard: () => {},
    onPlayCard: () => {},
    isMyTurn: true,
    phase: 'trickPlaying',
  },
};

export const FullHandOfEight: Story = {
  args: {
    cards: fullHand,
    validActions: [],
    selectedCard: null,
    onSelectCard: () => {},
    onPlayCard: () => {},
    isMyTurn: false,
    phase: 'bidding',
  },
};

export const WithMarriages: Story = {
  args: {
    cards: sampleHand,
    validActions: [playAction],
    selectedCard: null,
    onSelectCard: () => {},
    onPlayCard: () => {},
    isMyTurn: true,
    declaredMarriages: ['hearts'] as Suit[],
    phase: 'trickPlaying',
  },
};

export const FewCardsLeft: Story = {
  args: {
    cards: [
      { suit: 'hearts', rank: 'A' },
      { suit: 'clubs', rank: 'J' },
    ],
    validActions: [{ type: 'playCard', validCards: [{ suit: 'hearts', rank: 'A' }, { suit: 'clubs', rank: 'J' }] } as ValidAction],
    selectedCard: null,
    onSelectCard: () => {},
    onPlayCard: () => {},
    isMyTurn: true,
    phase: 'trickPlaying',
  },
};

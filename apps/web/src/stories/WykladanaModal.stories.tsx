import type { Meta, StoryObj } from '@storybook/react';
import { WykladanaModal } from '@/components/game/WykladanaModal';
import type { Card as CardType } from '@tysiac/shared';

const meta: Meta<typeof WykladanaModal> = {
  title: 'Game/WykladanaModal',
  component: WykladanaModal,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof WykladanaModal>;

const wykladanaCards: CardType[] = [
  { suit: 'hearts', rank: 'A' },
  { suit: 'hearts', rank: '10' },
  { suit: 'hearts', rank: 'K' },
  { suit: 'hearts', rank: 'Q' },
  { suit: 'hearts', rank: 'J' },
  { suit: 'hearts', rank: '9' },
  { suit: 'diamonds', rank: 'A' },
  { suit: 'diamonds', rank: 'K' },
  { suit: 'diamonds', rank: 'Q' },
];

export const Default: Story = {
  args: {
    playerName: 'You',
    bid: 100,
    marriagePoints: 180,
    cards: wykladanaCards,
    onComplete: () => {},
  },
};

export const WithoutMarriage: Story = {
  args: {
    playerName: 'Alice the Great',
    bid: 120,
    marriagePoints: 0,
    cards: wykladanaCards.slice(0, 8),
    onComplete: () => {},
  },
};

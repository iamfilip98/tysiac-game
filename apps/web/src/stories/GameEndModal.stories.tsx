import type { Meta, StoryObj } from '@storybook/react';
import { GameEndModal } from '@/components/game/GameEndModal';
import { FeltDecorator } from './decorators';
import type { GameStatistics } from '@tysiac/shared';

const meta: Meta<typeof GameEndModal> = {
  title: 'Game/GameEndModal',
  component: GameEndModal,
  decorators: [(Story) => <FeltDecorator><Story /></FeltDecorator>],
};

export default meta;
type Story = StoryObj<typeof GameEndModal>;

const players = [
  { id: 'p1', name: 'You' },
  { id: 'p2', name: 'Alice' },
  { id: 'p3', name: 'Bob' },
];

const stats: GameStatistics = {
  awards: [
    { id: 'a1', titleEn: 'Sharpshooter', titlePl: 'Snajper', emoji: '🎯', playerId: 'p1', value: 5, description: 'Made all 5 bids' },
    { id: 'a2', titleEn: 'Marriage Master', titlePl: 'Pan Małżeństw', emoji: '💍', playerId: 'p2', value: 4, description: 'Declared 4 marriages' },
    { id: 'a3', titleEn: 'Risk Taker', titlePl: 'Ryzykant', emoji: '🎲', playerId: 'p3', value: 200, description: 'Highest bid: 200' },
  ],
  totalRounds: 12,
  victoryMargin: 50,
};

export const WinnerIsMe: Story = {
  args: {
    winnerId: 'p1',
    players,
    scores: { p1: 1010, p2: 780, p3: 450 },
    currentPlayerId: 'p1',
    statistics: stats,
    onPlayAgain: () => {},
    onLeave: () => {},
  },
};

export const WinnerIsOther: Story = {
  args: {
    winnerId: 'p2',
    players,
    scores: { p1: 780, p2: 1020, p3: 600 },
    currentPlayerId: 'p1',
    statistics: stats,
    onPlayAgain: () => {},
    onLeave: () => {},
  },
};

export const NoStats: Story = {
  args: {
    winnerId: 'p1',
    players,
    scores: { p1: 1000, p2: 500, p3: 300 },
    currentPlayerId: 'p1',
    statistics: null,
    onPlayAgain: () => {},
    onLeave: () => {},
  },
};

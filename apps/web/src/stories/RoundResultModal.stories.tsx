import type { Meta, StoryObj } from '@storybook/react';
import { RoundResultModal } from '@/components/game/RoundResultModal';
import { FeltDecorator } from './decorators';
import type { RoundResult } from '@tysiac/shared';

const meta: Meta<typeof RoundResultModal> = {
  title: 'Game/RoundResultModal',
  component: RoundResultModal,
  decorators: [(Story) => <FeltDecorator><Story /></FeltDecorator>],
};

export default meta;
type Story = StoryObj<typeof RoundResultModal>;

const players = [
  { id: 'p1', name: 'You' },
  { id: 'p2', name: 'Alice' },
  { id: 'p3', name: 'Bob' },
];

export const BidMade: Story = {
  args: {
    result: {
      roundNumber: 5,
      bidWinner: 'p1',
      bid: 150,
      bidderMadeBid: true,
      playerResults: [
        { playerId: 'p1', trickPoints: 91, marriagePoints: 100, totalRoundPoints: 191, scoreChange: 150, newTotalScore: 650, wasOnBarrel: false, fellOffBarrel: false },
        { playerId: 'p2', trickPoints: 19, marriagePoints: 0, totalRoundPoints: 19, scoreChange: 20, newTotalScore: 420, wasOnBarrel: false, fellOffBarrel: false },
        { playerId: 'p3', trickPoints: 10, marriagePoints: 0, totalRoundPoints: 10, scoreChange: 10, newTotalScore: 310, wasOnBarrel: false, fellOffBarrel: false },
      ],
    } satisfies RoundResult,
    players,
    onClose: () => {},
  },
};

export const BidFailed: Story = {
  args: {
    result: {
      roundNumber: 3,
      bidWinner: 'p2',
      bid: 120,
      bidderMadeBid: false,
      playerResults: [
        { playerId: 'p1', trickPoints: 50, marriagePoints: 0, totalRoundPoints: 50, scoreChange: 50, newTotalScore: 290, wasOnBarrel: false, fellOffBarrel: false },
        { playerId: 'p2', trickPoints: 60, marriagePoints: 0, totalRoundPoints: 60, scoreChange: -120, newTotalScore: 80, wasOnBarrel: false, fellOffBarrel: false },
        { playerId: 'p3', trickPoints: 10, marriagePoints: 0, totalRoundPoints: 10, scoreChange: 10, newTotalScore: 200, wasOnBarrel: false, fellOffBarrel: false },
      ],
    } satisfies RoundResult,
    players,
    onClose: () => {},
  },
};

export const WithBarrel: Story = {
  args: {
    result: {
      roundNumber: 10,
      bidWinner: 'p1',
      bid: 110,
      bidderMadeBid: false,
      playerResults: [
        { playerId: 'p1', trickPoints: 40, marriagePoints: 0, totalRoundPoints: 40, scoreChange: -110, newTotalScore: 740, wasOnBarrel: true, fellOffBarrel: true },
        { playerId: 'p2', trickPoints: 50, marriagePoints: 0, totalRoundPoints: 50, scoreChange: 50, newTotalScore: 620, wasOnBarrel: false, fellOffBarrel: false },
        { playerId: 'p3', trickPoints: 30, marriagePoints: 0, totalRoundPoints: 30, scoreChange: 30, newTotalScore: 550, wasOnBarrel: false, fellOffBarrel: false },
      ],
    } satisfies RoundResult,
    players,
    onClose: () => {},
  },
};

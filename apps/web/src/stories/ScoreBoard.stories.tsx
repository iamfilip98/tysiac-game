import type { Meta, StoryObj } from '@storybook/react';
import { ScoreBoard, InlineScore } from '@/components/game/ScoreBoard';
import { FeltDecoratorCompact } from './decorators';

const meta: Meta<typeof ScoreBoard> = {
  title: 'Game/ScoreBoard',
  component: ScoreBoard,
  decorators: [(Story) => <FeltDecoratorCompact><Story /></FeltDecoratorCompact>],
};

export default meta;
type Story = StoryObj<typeof ScoreBoard>;

const threePlayers = [
  { id: 'p1', name: 'You', isAI: false },
  { id: 'p2', name: 'Alice', isAI: false },
  { id: 'p3', name: 'Bob (AI)', isAI: true },
];

const fourPlayers = [
  { id: 'p1', name: 'You', isAI: false },
  { id: 'p2', name: 'Alice', isAI: false },
  { id: 'p3', name: 'Bob', isAI: false },
  { id: 'p4', name: 'Charlie_AI', isAI: true },
];

export const ThreePlayerEarlyGame: Story = {
  args: {
    players: threePlayers,
    scores: {
      p1: { totalScore: 120, roundScores: [120], isOnBarrel: false },
      p2: { totalScore: 80, roundScores: [80], isOnBarrel: false },
      p3: { totalScore: -100, roundScores: [-100], isOnBarrel: false },
    },
    currentPlayerId: 'p1',
    roundNumber: 2,
    dealerId: 'p3',
    phase: 'bidding',
  },
};

export const WithBidWinner: Story = {
  args: {
    players: threePlayers,
    scores: {
      p1: { totalScore: 450, roundScores: [120, 130, 200], isOnBarrel: false },
      p2: { totalScore: 380, roundScores: [80, 150, 150], isOnBarrel: false },
      p3: { totalScore: 210, roundScores: [-100, 110, 200], isOnBarrel: false },
    },
    currentPlayerId: 'p1',
    bidWinner: 'p2',
    finalBid: 150,
    trumpSuit: 'hearts',
    roundNumber: 4,
    completedTricks: 3,
    phase: 'trickPlaying',
    dealerId: 'p1',
  },
};

export const WithBarrel: Story = {
  args: {
    players: threePlayers,
    scores: {
      p1: { totalScore: 850, roundScores: [120, 130, 200, 400], isOnBarrel: true },
      p2: { totalScore: 680, roundScores: [80, 150, 150, 300], isOnBarrel: false },
      p3: { totalScore: 410, roundScores: [-100, 110, 200, 200], isOnBarrel: false },
    },
    currentPlayerId: 'p1',
    trumpSuit: 'spades',
    roundNumber: 8,
    completedTricks: 5,
    phase: 'trickPlaying',
    dealerId: 'p2',
  },
};

export const FourPlayerMode: Story = {
  args: {
    players: fourPlayers,
    scores: {
      p1: { totalScore: 320, roundScores: [120, 200], isOnBarrel: false },
      p2: { totalScore: 180, roundScores: [80, 100], isOnBarrel: false },
      p3: { totalScore: 250, roundScores: [150, 100], isOnBarrel: false },
      p4: { totalScore: 90, roundScores: [40, 50], isOnBarrel: false },
    },
    currentPlayerId: 'p1',
    bidWinner: 'p3',
    finalBid: 120,
    trumpSuit: 'diamonds',
    roundNumber: 3,
    dealerId: 'p4',
    phase: 'trickPlaying',
    completedTricks: 1,
  },
};

export const NegativeScores: Story = {
  args: {
    players: threePlayers,
    scores: {
      p1: { totalScore: -200, roundScores: [-100, -100], isOnBarrel: false },
      p2: { totalScore: 380, roundScores: [180, 200], isOnBarrel: false },
      p3: { totalScore: 210, roundScores: [110, 100], isOnBarrel: false },
    },
    currentPlayerId: 'p1',
    roundNumber: 3,
    dealerId: 'p1',
  },
};

export const InlineScoreDisplay: Story = {
  render: () => (
    <div className="flex flex-col gap-2 bg-table-800/90 p-4 rounded-lg">
      <div className="flex items-center gap-3">
        <span className="text-white/60 text-sm w-20">Normal:</span>
        <InlineScore score={450} />
      </div>
      <div className="flex items-center gap-3">
        <span className="text-white/60 text-sm w-20">Negative:</span>
        <InlineScore score={-200} />
      </div>
      <div className="flex items-center gap-3">
        <span className="text-white/60 text-sm w-20">Barrel:</span>
        <InlineScore score={850} isOnBarrel />
      </div>
    </div>
  ),
};

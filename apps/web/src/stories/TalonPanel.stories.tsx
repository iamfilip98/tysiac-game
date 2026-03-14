import type { Meta, StoryObj } from '@storybook/react';
import { TalonDisplay } from '@/components/game/TalonPanel';
import { DistributionModal } from '@/components/game/DistributionModal';
import { FeltDecoratorCompact } from './decorators';
import type { Card as CardType, GamePlayer } from '@tysiac/shared';

const meta: Meta = {
  title: 'Game/TalonPanel',
  decorators: [(Story) => <FeltDecoratorCompact><Story /></FeltDecoratorCompact>],
};

export default meta;

const talonCards: CardType[] = [
  { suit: 'hearts', rank: 'Q' },
  { suit: 'spades', rank: '9' },
  { suit: 'diamonds', rank: 'J' },
];

export const FaceDown: StoryObj = {
  render: () => <TalonDisplay talon={talonCards} isRevealed={false} />,
};

export const Revealed: StoryObj = {
  render: () => <TalonDisplay talon={talonCards} isRevealed={true} />,
};

const otherPlayers: GamePlayer[] = [
  { id: 'p2', name: 'Alice', isAI: false, seatIndex: 1 },
  { id: 'p3', name: 'Bob', isAI: true, seatIndex: 2 },
];

const sampleHand: CardType[] = [
  { suit: 'hearts', rank: 'A' },
  { suit: 'hearts', rank: 'K' },
  { suit: 'hearts', rank: 'Q' },
  { suit: 'clubs', rank: '10' },
  { suit: 'clubs', rank: 'J' },
  { suit: 'diamonds', rank: 'A' },
  { suit: 'diamonds', rank: 'K' },
  { suit: 'spades', rank: 'Q' },
  { suit: 'spades', rank: '9' },
  { suit: 'diamonds', rank: '9' },
];

export const Distribution: StoryObj = {
  render: () => (
    <DistributionModal
      hand={sampleHand}
      otherPlayers={otherPlayers}
      onDistribute={(dist) => console.log('distribute', dist)}
    />
  ),
};

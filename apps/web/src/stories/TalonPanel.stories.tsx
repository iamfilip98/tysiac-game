import type { Meta, StoryObj } from '@storybook/react';
import { TalonDisplay, TalonDistributionPanel } from '@/components/game/TalonPanel';
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

export const DistributionEmpty: StoryObj = {
  render: () => (
    <TalonDistributionPanel
      otherPlayers={otherPlayers}
      selectedCards={new Map()}
      currentTarget={null}
      onSelectTarget={() => {}}
      onDistribute={() => {}}
    />
  ),
};

export const DistributionOneSelected: StoryObj = {
  render: () => {
    const selected = new Map<string, CardType>();
    selected.set('p2', { suit: 'hearts', rank: 'Q' });
    return (
      <TalonDistributionPanel
        otherPlayers={otherPlayers}
        selectedCards={selected}
        currentTarget="p3"
        onSelectTarget={() => {}}
        onDistribute={() => {}}
      />
    );
  },
};

export const DistributionComplete: StoryObj = {
  render: () => {
    const selected = new Map<string, CardType>();
    selected.set('p2', { suit: 'hearts', rank: 'Q' });
    selected.set('p3', { suit: 'spades', rank: '9' });
    return (
      <TalonDistributionPanel
        otherPlayers={otherPlayers}
        selectedCards={selected}
        currentTarget={null}
        onSelectTarget={() => {}}
        onDistribute={() => {}}
      />
    );
  },
};

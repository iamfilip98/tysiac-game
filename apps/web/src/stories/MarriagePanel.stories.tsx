import type { Meta, StoryObj } from '@storybook/react';
import { MarriagePanel, DeclaredMarriages } from '@/components/game/MarriagePanel';
import { FeltDecoratorCompact } from './decorators';
import type { Suit } from '@tysiac/shared';

const meta: Meta = {
  title: 'Game/MarriagePanel',
  decorators: [(Story) => <FeltDecoratorCompact><Story /></FeltDecoratorCompact>],
};

export default meta;

export const OneSuit: StoryObj = {
  render: () => (
    <MarriagePanel
      availableSuits={['hearts'] as Suit[]}
      onDeclare={() => {}}
      onSkip={() => {}}
    />
  ),
};

export const MultipleSuits: StoryObj = {
  render: () => (
    <MarriagePanel
      availableSuits={['hearts', 'diamonds', 'spades'] as Suit[]}
      onDeclare={() => {}}
      onSkip={() => {}}
    />
  ),
};

export const AllSuits: StoryObj = {
  render: () => (
    <MarriagePanel
      availableSuits={['hearts', 'diamonds', 'clubs', 'spades'] as Suit[]}
      onDeclare={() => {}}
      onSkip={() => {}}
    />
  ),
};

export const DeclaredMarriagesDisplay: StoryObj = {
  render: () => (
    <DeclaredMarriages
      marriages={['hearts', 'diamonds'] as Suit[]}
      totalPoints={180}
    />
  ),
};

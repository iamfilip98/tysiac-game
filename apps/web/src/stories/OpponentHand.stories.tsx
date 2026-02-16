import type { Meta, StoryObj } from '@storybook/react';
import { OpponentHand } from '@/components/game/OpponentHand';
import { FeltDecorator } from './decorators';

const meta: Meta<typeof OpponentHand> = {
  title: 'Game/OpponentHand',
  component: OpponentHand,
  decorators: [(Story) => <FeltDecorator><Story /></FeltDecorator>],
};

export default meta;
type Story = StoryObj<typeof OpponentHand>;

export const LeftPosition: Story = {
  args: { cardCount: 7, position: 'left', playerName: 'Alice', isCurrentTurn: false },
};

export const RightPosition: Story = {
  args: { cardCount: 7, position: 'right', playerName: 'Bob_the_Great', isCurrentTurn: false },
};

export const TopPosition: Story = {
  args: { cardCount: 7, position: 'top', playerName: 'Charlie', isCurrentTurn: false },
};

export const CurrentTurn: Story = {
  args: { cardCount: 6, position: 'left', playerName: 'Alice', isCurrentTurn: true },
};

export const FewCards: Story = {
  args: { cardCount: 2, position: 'left', playerName: 'Late Game', isCurrentTurn: false },
};

export const AllPositions: Story = {
  render: () => (
    <div className="relative w-[500px] h-[400px]">
      <div className="absolute left-0 top-1/2 -translate-y-1/2">
        <OpponentHand cardCount={7} position="left" playerName="Alice" />
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 top-0">
        <OpponentHand cardCount={7} position="top" playerName="Bob" isCurrentTurn />
      </div>
      <div className="absolute right-0 top-1/2 -translate-y-1/2">
        <OpponentHand cardCount={7} position="right" playerName="Charlie" />
      </div>
    </div>
  ),
};

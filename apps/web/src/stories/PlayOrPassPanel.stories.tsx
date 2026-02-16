import type { Meta, StoryObj } from '@storybook/react';
import { PlayOrPassPanel } from '@/components/game/PlayOrPassPanel';
import { FeltDecoratorCompact } from './decorators';

const meta: Meta<typeof PlayOrPassPanel> = {
  title: 'Game/PlayOrPassPanel',
  component: PlayOrPassPanel,
  decorators: [(Story) => <FeltDecoratorCompact><Story /></FeltDecoratorCompact>],
};

export default meta;
type Story = StoryObj<typeof PlayOrPassPanel>;

export const MyTurnAt100: Story = {
  args: {
    onPlay: () => {},
    onPass: () => {},
    isMyTurn: true,
    bidAmount: 100,
    playerCount: 3,
  },
};

export const MyTurnAt150: Story = {
  args: {
    onPlay: () => {},
    onPass: () => {},
    isMyTurn: true,
    bidAmount: 150,
    playerCount: 3,
  },
};

export const Waiting: Story = {
  args: {
    onPlay: () => {},
    onPass: () => {},
    isMyTurn: false,
    bidAmount: 120,
    playerCount: 3,
  },
};

export const FourPlayerMode: Story = {
  args: {
    onPlay: () => {},
    onPass: () => {},
    isMyTurn: true,
    bidAmount: 110,
    playerCount: 4,
  },
};

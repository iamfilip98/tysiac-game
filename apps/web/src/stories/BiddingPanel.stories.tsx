import type { Meta, StoryObj } from '@storybook/react';
import { BiddingPanel } from '@/components/game/BiddingPanel';
import { FeltDecoratorCompact } from './decorators';
import type { ValidAction } from '@tysiac/shared';

const meta: Meta<typeof BiddingPanel> = {
  title: 'Game/BiddingPanel',
  component: BiddingPanel,
  decorators: [(Story) => <FeltDecoratorCompact><Story /></FeltDecoratorCompact>],
};

export default meta;
type Story = StoryObj<typeof BiddingPanel>;

const bidAction: ValidAction = { type: 'bid', minBid: 110, maxBid: 200 };
const passAction: ValidAction = { type: 'pass' };

export const MyTurn: Story = {
  args: {
    validActions: [bidAction, passAction],
    currentBid: 100,
    onBid: () => {},
    onPass: () => {},
    isMyTurn: true,
  },
};

export const MyTurnHighBid: Story = {
  args: {
    validActions: [{ type: 'bid', minBid: 180, maxBid: 200 } as ValidAction, passAction],
    currentBid: 170,
    onBid: () => {},
    onPass: () => {},
    isMyTurn: true,
  },
};

export const MyTurnMaxReached: Story = {
  args: {
    validActions: [{ type: 'bid', minBid: 210, maxBid: 200 } as ValidAction, passAction],
    currentBid: 200,
    onBid: () => {},
    onPass: () => {},
    isMyTurn: true,
  },
};

export const Waiting: Story = {
  args: {
    validActions: [],
    currentBid: 130,
    onBid: () => {},
    onPass: () => {},
    isMyTurn: false,
  },
};

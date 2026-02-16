import type { Meta, StoryObj } from '@storybook/react';
import { ElectricBorder, CardGlow } from '@/components/ui/ElectricBorder';
import { FeltDecoratorCompact } from './decorators';

const meta: Meta<typeof ElectricBorder> = {
  title: 'UI/ElectricBorder',
  component: ElectricBorder,
  decorators: [(Story) => <FeltDecoratorCompact><Story /></FeltDecoratorCompact>],
};

export default meta;
type Story = StoryObj<typeof ElectricBorder>;

export const Active: Story = {
  args: {
    active: true,
    children: (
      <div className="bg-table-800/90 p-6 rounded-xl text-white text-center">
        <h3 className="text-lg font-bold text-gold-400 mb-2">Your Turn!</h3>
        <p className="text-white/60">Make your move</p>
      </div>
    ),
  },
};

export const Inactive: Story = {
  args: {
    active: false,
    children: (
      <div className="bg-table-800/90 p-6 rounded-xl text-white text-center">
        <p className="text-white/60">Waiting for other players...</p>
      </div>
    ),
  },
};

export const CustomColor: Story = {
  args: {
    active: true,
    color: '#60a5fa',
    children: (
      <div className="bg-table-800/90 p-6 rounded-xl text-white text-center">
        <h3 className="text-lg font-bold text-blue-400">Trump Suit Active</h3>
      </div>
    ),
  },
};

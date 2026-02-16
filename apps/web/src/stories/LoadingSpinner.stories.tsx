import type { Meta, StoryObj } from '@storybook/react';
import { LoadingSpinner, CardDealingAnimation, ThinkingDots } from '@/components/ui/LoadingSpinner';
import { FeltDecoratorCompact } from './decorators';

const meta: Meta<typeof LoadingSpinner> = {
  title: 'UI/LoadingSpinner',
  component: LoadingSpinner,
  decorators: [(Story) => <FeltDecoratorCompact><Story /></FeltDecoratorCompact>],
};

export default meta;
type Story = StoryObj<typeof LoadingSpinner>;

export const Small: Story = { args: { size: 'sm' } };
export const Medium: Story = { args: { size: 'md' } };
export const Large: Story = { args: { size: 'lg' } };

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-8">
      <div className="flex flex-col items-center gap-2">
        <LoadingSpinner size="sm" />
        <span className="text-white/60 text-xs">sm</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <LoadingSpinner size="md" />
        <span className="text-white/60 text-xs">md</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <LoadingSpinner size="lg" />
        <span className="text-white/60 text-xs">lg</span>
      </div>
    </div>
  ),
};

export const CardDealing: Story = {
  render: () => <CardDealingAnimation />,
};

export const Thinking: Story = {
  render: () => (
    <div className="flex items-center gap-2 text-white/60">
      Opponent is thinking <ThinkingDots />
    </div>
  ),
};

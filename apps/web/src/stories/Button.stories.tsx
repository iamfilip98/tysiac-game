import type { Meta, StoryObj } from '@storybook/react';
import { Button, MotionButton } from '@/components/ui/Button';
import { FeltDecoratorCompact } from './decorators';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  decorators: [(Story) => <FeltDecoratorCompact><Story /></FeltDecoratorCompact>],
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    glow: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { children: 'Bid 110', variant: 'primary', glow: true },
};

export const Secondary: Story = {
  args: { children: 'Pass', variant: 'secondary' },
};

export const Ghost: Story = {
  args: { children: 'Cancel', variant: 'ghost' },
};

export const Danger: Story = {
  args: { children: 'Leave Game', variant: 'danger' },
};

export const Disabled: Story = {
  args: { children: 'Waiting...', variant: 'primary', disabled: true },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {(['primary', 'secondary', 'ghost', 'danger'] as const).map((variant) => (
        <div key={variant} className="flex gap-3 items-center">
          <Button variant={variant} size="sm">{variant} sm</Button>
          <Button variant={variant} size="md">{variant} md</Button>
          <Button variant={variant} size="lg">{variant} lg</Button>
          <Button variant={variant} size="md" disabled>{variant} disabled</Button>
        </div>
      ))}
      <div className="flex gap-3 items-center">
        <Button variant="primary" glow>Primary + Glow</Button>
      </div>
    </div>
  ),
};

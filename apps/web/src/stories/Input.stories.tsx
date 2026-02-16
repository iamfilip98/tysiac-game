import type { Meta, StoryObj } from '@storybook/react';
import { Input } from '@/components/ui/Input';
import { FeltDecoratorCompact } from './decorators';

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  decorators: [(Story) => <FeltDecoratorCompact><Story /></FeltDecoratorCompact>],
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: { placeholder: 'Enter your name...', label: 'Player Name', id: 'name' },
};

export const WithError: Story = {
  args: { placeholder: 'Enter room code...', label: 'Room Code', id: 'code', error: 'Invalid room code', value: 'ABC' },
};

export const WithValue: Story = {
  args: { label: 'Room Name', id: 'room', value: 'Friday Night Cards' },
};

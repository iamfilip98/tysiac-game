import type { Meta, StoryObj } from '@storybook/react';
import { LeaveGameModal } from '@/components/game/LeaveGameModal';
import { FeltDecorator } from './decorators';

const meta: Meta<typeof LeaveGameModal> = {
  title: 'Game/LeaveGameModal',
  component: LeaveGameModal,
  decorators: [(Story) => <FeltDecorator><Story /></FeltDecorator>],
};

export default meta;
type Story = StoryObj<typeof LeaveGameModal>;

export const Default: Story = {
  args: {
    onConfirm: () => {},
    onCancel: () => {},
  },
};

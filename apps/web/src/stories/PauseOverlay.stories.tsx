import type { Meta, StoryObj } from '@storybook/react';
import { PauseOverlay } from '@/components/game/PauseOverlay';

const meta: Meta<typeof PauseOverlay> = {
  title: 'Game/PauseOverlay',
  component: PauseOverlay,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof PauseOverlay>;

export const JustPaused: Story = {
  args: {
    pausedByName: 'Alice',
    pausedAt: Date.now(),
    onResume: () => {},
  },
};

export const HalfwayExpired: Story = {
  args: {
    pausedByName: 'Bob',
    pausedAt: Date.now() - 30 * 60 * 1000, // 30 minutes ago
    onResume: () => {},
  },
};

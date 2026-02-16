import type { Meta, StoryObj } from '@storybook/react';
import { useEffect } from 'react';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { FeltDecoratorCompact } from './decorators';

function ToastDemo() {
  const { showToast } = useToast();
  return (
    <div className="flex flex-col gap-3">
      <Button variant="primary" onClick={() => showToast('Room created successfully!', 'success')}>
        Show Success Toast
      </Button>
      <Button variant="danger" onClick={() => showToast('Failed to connect to server', 'error')}>
        Show Error Toast
      </Button>
      <Button variant="secondary" onClick={() => showToast('Opponent is taking their turn...', 'info')}>
        Show Info Toast
      </Button>
      <Button variant="secondary" onClick={() => showToast('Connection unstable', 'warning')}>
        Show Warning Toast
      </Button>
    </div>
  );
}

const meta: Meta = {
  title: 'UI/Toast',
  decorators: [
    (Story) => (
      <FeltDecoratorCompact>
        <ToastProvider>
          <Story />
        </ToastProvider>
      </FeltDecoratorCompact>
    ),
  ],
};

export default meta;
type Story = StoryObj;

export const Interactive: Story = {
  render: () => <ToastDemo />,
};

function AutoShowToasts() {
  const { showToast } = useToast();
  useEffect(() => {
    showToast('Game started!', 'success');
    setTimeout(() => showToast('Connection restored', 'info'), 500);
    setTimeout(() => showToast('Opponent disconnected', 'warning'), 1000);
  }, [showToast]);
  return <p className="text-white/60">Toasts auto-triggered</p>;
}

export const AllTypes: Story = {
  render: () => <AutoShowToasts />,
};

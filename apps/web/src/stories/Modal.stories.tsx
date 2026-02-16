import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FeltDecorator } from './decorators';

const meta: Meta<typeof Modal> = {
  title: 'UI/Modal',
  component: Modal,
  decorators: [(Story) => <FeltDecorator><Story /></FeltDecorator>],
};

export default meta;
type Story = StoryObj<typeof Modal>;

export const Open: Story = {
  render: () => (
    <Modal isOpen onClose={() => {}}>
      <ModalHeader onClose={() => {}}>Game Rules</ModalHeader>
      <ModalBody>
        <p className="mb-3">Tysiąc (1000) is a classic Polish trick-taking card game.</p>
        <p>The goal is to be the first player to reach 1000 points by winning tricks and declaring marriages.</p>
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" className="flex-1">Cancel</Button>
        <Button variant="primary" className="flex-1">Got it!</Button>
      </ModalFooter>
    </Modal>
  ),
};

export const WithLongContent: Story = {
  render: () => (
    <Modal isOpen onClose={() => {}}>
      <ModalHeader onClose={() => {}}>Round Results</ModalHeader>
      <ModalBody>
        {Array.from({ length: 10 }).map((_, i) => (
          <p key={i} className="mb-3">
            Round {i + 1}: Player scored {100 + i * 10} points. The bidding went through multiple rounds
            before settling at {110 + i * 10}.
          </p>
        ))}
      </ModalBody>
      <ModalFooter>
        <Button variant="primary" className="flex-1">Continue</Button>
      </ModalFooter>
    </Modal>
  ),
};

export const Interactive: Story = {
  render: function InteractiveModal() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open Modal</Button>
        <Modal isOpen={open} onClose={() => setOpen(false)}>
          <ModalHeader onClose={() => setOpen(false)}>Confirm Action</ModalHeader>
          <ModalBody>
            <p>Are you sure you want to leave the game?</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="danger" className="flex-1" onClick={() => setOpen(false)}>Leave</Button>
          </ModalFooter>
        </Modal>
      </>
    );
  },
};

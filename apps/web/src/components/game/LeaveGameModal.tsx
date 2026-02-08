'use client';

import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface LeaveGameModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function LeaveGameModal({ onConfirm, onCancel }: LeaveGameModalProps) {
  return (
    <Modal isOpen={true} onClose={onCancel} className="max-w-sm">
      <ModalHeader onClose={onCancel}>Leave Game?</ModalHeader>

      <ModalBody>
        <p className="text-white/80 mb-4">
          Are you sure you want to leave this game? An AI will take over your position and continue playing for you.
        </p>
        <p className="text-amber-400 text-sm">
          ⚠️ You will not be able to rejoin this game.
        </p>
      </ModalBody>

      <ModalFooter>
        <Button variant="secondary" onClick={onCancel}>
          Stay
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          Leave Game
        </Button>
      </ModalFooter>
    </Modal>
  );
}

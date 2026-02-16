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

      <ModalFooter className="grid grid-cols-2">
        <Button variant="secondary" onClick={onCancel}>
          Stay
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Leave Game
        </Button>
      </ModalFooter>
    </Modal>
  );
}

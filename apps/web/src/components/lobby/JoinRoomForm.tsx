'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ElectricBorder } from '@/components/ui/ElectricBorder';

interface JoinRoomFormProps {
  onSubmit: (playerName: string, roomCode: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

export function JoinRoomForm({ onSubmit, isLoading, error }: JoinRoomFormProps) {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim() && roomCode.trim()) {
      onSubmit(playerName.trim(), roomCode.trim().toUpperCase());
    }
  };

  return (
    <ElectricBorder active={false}>
      <form
        onSubmit={handleSubmit}
        className="bg-table-900/90 backdrop-blur p-6 rounded-xl border border-table-600"
      >
        <h2 className="text-xl font-bold text-white mb-4">Join Room</h2>

        <div className="space-y-4">
          <Input
            id="joinPlayerName"
            label="Your Name"
            placeholder="Enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={20}
            required
          />

          <Input
            id="roomCode"
            label="Room Code"
            placeholder="Enter 6-character code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="font-mono tracking-widest text-center text-lg"
            required
            error={error || undefined}
          />
        </div>

        <Button
          type="submit"
          variant="secondary"
          className="w-full mt-6"
          disabled={isLoading || !playerName.trim() || roomCode.length !== 6}
        >
          {isLoading ? 'Joining...' : 'Join Room'}
        </Button>
      </form>
    </ElectricBorder>
  );
}

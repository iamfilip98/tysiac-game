'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface JoinRoomFormProps {
  onSubmit: (playerName: string, roomCode: string) => void;
  isLoading?: boolean;
  isConnected?: boolean;
  initialCode?: string;
}

export function JoinRoomForm({ onSubmit, isLoading, isConnected = false, initialCode = '' }: JoinRoomFormProps) {
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState(initialCode);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim() && roomCode.trim()) {
      onSubmit(playerName.trim(), roomCode.trim().toUpperCase());
    }
  };

  return (
    <div className="rounded-xl border border-gold-500/20 shadow-glow-gold">
      <form
        onSubmit={handleSubmit}
        className="bg-gradient-to-b from-table-800/90 to-table-900/90 backdrop-blur-md p-6 rounded-xl"
        style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}
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
            className="font-mono tracking-widest text-center uppercase"
            required
          />

          {/* Spacer to match CreateRoomForm height (matches number of players section) */}
          <div aria-hidden="true">
            <div className="block text-sm font-medium text-transparent mb-2">
              Number of Players
            </div>
            <div className="flex gap-2">
              <div className="flex-1 py-2 px-4 rounded-lg font-medium text-transparent">3 Players</div>
              <div className="flex-1 py-2 px-4 rounded-lg font-medium text-transparent">4 Players</div>
            </div>
          </div>

          {/* Spacer to match CreateRoomForm height (matches private room toggle row) */}
          <div className="flex items-center gap-3" aria-hidden="true">
            <div className="w-12 h-6" />
            <span className="text-sm text-transparent">Private room</span>
          </div>
        </div>

        <Button
          type="submit"
          variant="secondary"
          className="w-full mt-6"
          disabled={!isConnected || isLoading || !playerName.trim() || roomCode.length !== 6}
        >
          {isLoading ? 'Connecting...' : !isConnected ? 'Waiting for connection...' : 'Join Room'}
        </Button>
      </form>
    </div>
  );
}

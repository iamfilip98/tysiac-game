'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

interface CreateRoomFormProps {
  onSubmit: (playerName: string, roomName: string, isPrivate: boolean) => void;
  isLoading?: boolean;
}

export function CreateRoomForm({ onSubmit, isLoading }: CreateRoomFormProps) {
  const [playerName, setPlayerName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim() && roomName.trim()) {
      onSubmit(playerName.trim(), roomName.trim(), isPrivate);
    }
  };

  return (
    <div className="rounded-xl border-2 border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.3)]">
      <form
        onSubmit={handleSubmit}
        className="bg-table-900/90 backdrop-blur p-6 rounded-xl"
      >
        <h2 className="text-xl font-bold text-white mb-4">Create New Room</h2>

        <div className="space-y-4">
          <Input
            id="playerName"
            label="Your Name"
            placeholder="Enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={20}
            required
          />

          <Input
            id="roomName"
            label="Room Name"
            placeholder="Enter room name"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            maxLength={30}
            required
          />

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPrivate(!isPrivate)}
              className={cn(
                'relative w-12 h-6 rounded-full transition-colors',
                isPrivate ? 'bg-gold-500' : 'bg-table-700'
              )}
            >
              <motion.div
                animate={{ x: isPrivate ? 24 : 2 }}
                className="absolute top-1 w-4 h-4 bg-white rounded-full"
              />
            </button>
            <span className="text-sm text-white/80">Private room</span>
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full mt-6"
          disabled={isLoading || !playerName.trim() || !roomName.trim()}
          glow
        >
          {isLoading ? 'Creating...' : 'Create Room'}
        </Button>
      </form>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

interface CreateRoomFormProps {
  onSubmit: (roomName: string, isPrivate: boolean, maxPlayers: 3 | 4) => void;
  isLoading?: boolean;
  isConnected?: boolean;
  disabled?: boolean;
}

export function CreateRoomForm({ onSubmit, isLoading, isConnected = false, disabled }: CreateRoomFormProps) {
  const [roomName, setRoomName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState<3 | 4>(3);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomName.trim()) {
      onSubmit(roomName.trim(), isPrivate, maxPlayers);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="roomName"
        label="Room Name"
        placeholder="Enter room name"
        value={roomName}
        onChange={(e) => setRoomName(e.target.value)}
        maxLength={30}
        required
      />

      <div>
        <label className="block text-sm font-medium text-white/80 mb-2">
          Number of Players
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMaxPlayers(3)}
            className={cn(
              'flex-1 py-2 px-4 rounded-lg font-medium transition-all',
              maxPlayers === 3
                ? 'bg-gold-500 text-table-950 shadow-[0_0_10px_rgba(251,191,36,0.3)]'
                : 'bg-table-700 text-white/70 hover:bg-table-600 hover:text-white'
            )}
          >
            3 Players
          </button>
          <button
            type="button"
            onClick={() => setMaxPlayers(4)}
            className={cn(
              'flex-1 py-2 px-4 rounded-lg font-medium transition-all',
              maxPlayers === 4
                ? 'bg-gold-500 text-table-950 shadow-[0_0_10px_rgba(251,191,36,0.3)]'
                : 'bg-table-700 text-white/70 hover:bg-table-600 hover:text-white'
            )}
          >
            4 Players
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsPrivate(!isPrivate)}
          className={cn(
            'relative w-12 h-6 rounded-full transition-all',
            isPrivate ? 'bg-gold-500 shadow-[0_0_10px_rgba(251,191,36,0.3)]' : 'bg-table-700'
          )}
        >
          <motion.div
            animate={{ x: isPrivate ? 24 : 2 }}
            className="absolute top-1 w-4 h-4 bg-white rounded-full"
          />
        </button>
        <span className="text-sm text-white/80">Private room</span>
      </div>

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={!isConnected || isLoading || disabled || !roomName.trim()}
        glow
      >
        {!isConnected ? 'Waiting for connection...' : isLoading ? 'Creating Room...' : 'Create Room'}
      </Button>
    </form>
  );
}

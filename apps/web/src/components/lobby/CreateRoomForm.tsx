'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

interface CreateRoomFormProps {
  onSubmit: (playerName: string, roomName: string, isPrivate: boolean, maxPlayers: 3 | 4) => void;
  isLoading?: boolean;
}

export function CreateRoomForm({ onSubmit, isLoading }: CreateRoomFormProps) {
  const [playerName, setPlayerName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState<3 | 4>(3);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim() && roomName.trim()) {
      onSubmit(playerName.trim(), roomName.trim(), isPrivate, maxPlayers);
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
                    ? 'bg-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.4)]'
                    : 'bg-table-700 text-white/70 hover:bg-table-600'
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
                    ? 'bg-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.4)]'
                    : 'bg-table-700 text-white/70 hover:bg-table-600'
                )}
              >
                4 Players
              </button>
            </div>
            {maxPlayers === 4 && (
              <p className="text-xs text-white/50 mt-1">
                In 4-player mode, the dealer sits out each round
              </p>
            )}
          </div>

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

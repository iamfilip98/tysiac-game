'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

interface CreateRoomFormProps {
  onSubmit: (playerName: string, roomName: string, isPrivate: boolean, maxPlayers: 3 | 4) => void;
  isLoading?: boolean;
  isConnected?: boolean;
  defaultPlayerName?: string;
}

export function CreateRoomForm({ onSubmit, isLoading, isConnected = false, defaultPlayerName = '' }: CreateRoomFormProps) {
  const [playerName, setPlayerName] = useState(defaultPlayerName);
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
    <div className="rounded-xl border border-gold-500/20 shadow-glow-gold transition-shadow duration-300 hover:shadow-[0_0_30px_rgba(251,191,36,0.2)]">
      <form
        onSubmit={handleSubmit}
        className="bg-gradient-to-b from-table-800/90 to-table-900/90 backdrop-blur-md p-6 rounded-xl"
        style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}
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
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full mt-6"
          disabled={!isConnected || isLoading || !playerName.trim() || !roomName.trim()}
          glow
        >
          {!isConnected ? 'Waiting for connection...' : isLoading ? 'Creating Room...' : 'Create Room'}
        </Button>
      </form>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import type { Room } from '@tysiac/shared';

interface RoomBrowserProps {
  publicRooms: Room[];
  onJoin: (playerName: string, roomCode: string) => void;
  isLoading?: boolean;
  isConnected?: boolean;
  initialCode?: string;
}

export function RoomBrowser({ publicRooms, onJoin, isLoading, isConnected = false, initialCode = '' }: RoomBrowserProps) {
  const [playerName, setPlayerName] = useState('');
  const [showPrivate, setShowPrivate] = useState(!!initialCode);
  const [privateCode, setPrivateCode] = useState(initialCode);

  const joinableRooms = publicRooms.filter(r => !r.gameId);

  const handleJoinRoom = (roomCode: string) => {
    if (!playerName.trim()) return;
    onJoin(playerName.trim(), roomCode);
  };

  const handlePrivateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim() && privateCode.trim()) {
      onJoin(playerName.trim(), privateCode.trim().toUpperCase());
    }
  };

  return (
    <div className="rounded-xl border-2 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
      <div className="bg-table-900/90 backdrop-blur p-6 rounded-xl min-h-[370px] flex flex-col">
        <h2 className="text-xl font-bold text-white mb-4">Browse Rooms</h2>

        {/* Name input */}
        <div className="mb-4">
          <Input
            id="browserPlayerName"
            label="Your Name"
            placeholder="Enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={20}
            required
          />
        </div>

        {/* Room list */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-white/80 mb-2">
            Public Rooms
          </label>
          <div className="min-h-[140px] max-h-[200px] overflow-y-auto rounded-lg border border-table-600 bg-table-950/50">
            {joinableRooms.length === 0 ? (
              <div className="flex items-center justify-center h-[140px] text-white/40 text-sm px-4 text-center">
                No public rooms available. Create one!
              </div>
            ) : (
              <div className="divide-y divide-table-700">
                {joinableRooms.map((room) => (
                  <div
                    key={room.id}
                    className="flex items-center justify-between px-3 py-2.5 hover:bg-table-800/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <div className="text-white text-sm font-medium truncate">
                        {room.name}
                      </div>
                      <div className="text-white/50 text-xs">
                        {room.players.find(p => p.isHost)?.name || 'Unknown'} · {room.players.length}/{room.maxPlayers} players
                      </div>
                    </div>
                    <button
                      onClick={() => handleJoinRoom(room.code)}
                      disabled={!isConnected || isLoading || !playerName.trim() || room.players.length >= room.maxPlayers}
                      className={cn(
                        'px-3 py-1 rounded-md text-xs font-medium transition-all shrink-0',
                        playerName.trim() && room.players.length < room.maxPlayers
                          ? 'bg-blue-500 hover:bg-blue-400 text-white'
                          : 'bg-table-700 text-white/30 cursor-not-allowed'
                      )}
                    >
                      {room.players.length >= room.maxPlayers ? 'Full' : 'Join'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Private room section */}
        <div className="border-t border-table-600 pt-3 mt-auto">
          <button
            type="button"
            onClick={() => setShowPrivate(!showPrivate)}
            className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors w-full"
          >
            <span className={cn(
              'transition-transform text-xs',
              showPrivate && 'rotate-90'
            )}>
              ▶
            </span>
            Join Private Room
          </button>

          <AnimatePresence>
            {showPrivate && (
              <motion.form
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
                onSubmit={handlePrivateSubmit}
              >
                <div className="flex gap-2 mt-3">
                  <Input
                    id="privateRoomCode"
                    placeholder="Room code"
                    value={privateCode}
                    onChange={(e) => setPrivateCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    className="font-mono tracking-widest text-center uppercase"
                  />
                  <Button
                    type="submit"
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    disabled={!isConnected || isLoading || !playerName.trim() || privateCode.length !== 6}
                  >
                    Join
                  </Button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

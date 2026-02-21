'use client';

import { useState } from 'react';
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

// "Blue Box" — Browse Rooms panel (matches Green Box height via grid layout in page.tsx)
export function RoomBrowser({ publicRooms, onJoin, isLoading, isConnected = false, initialCode = '' }: RoomBrowserProps) {
  const [playerName, setPlayerName] = useState('');
  const [unlockingRoomId, setUnlockingRoomId] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState(initialCode);

  const handleJoinPublic = (roomCode: string) => {
    if (!playerName.trim()) return;
    onJoin(playerName.trim(), roomCode);
  };

  const handleJoinPrivate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim() || codeInput.length !== 6) return;
    onJoin(playerName.trim(), codeInput.trim().toUpperCase());
    setUnlockingRoomId(null);
    setCodeInput('');
  };

  const toggleUnlock = (roomId: string) => {
    if (unlockingRoomId === roomId) {
      setUnlockingRoomId(null);
      setCodeInput('');
    } else {
      setUnlockingRoomId(roomId);
      setCodeInput('');
    }
  };

  return (
    <div className="rounded-xl border border-gold-500/20 shadow-glow-gold h-full">
      <div className="bg-gradient-to-b from-table-800/90 to-table-900/90 backdrop-blur-md p-6 rounded-xl h-full flex flex-col" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}>
        <h2 className="text-xl font-bold text-white mb-4">Browse Rooms</h2>

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

        {/* Room list — flex-1 fills remaining height to match Green Box */}
        <div className="flex-1 flex flex-col">
          <label className="block text-sm font-medium text-white/80 mb-2">
            Available Rooms
          </label>
          <div className="flex-1 overflow-y-auto rounded-lg border border-white/[0.08] bg-table-950/50">
            {publicRooms.length === 0 ? (
              <div className="flex items-center justify-center h-full text-white/40 text-sm px-4 text-center">
                No rooms available. Create one!
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {publicRooms.map((room) => {
                  const isFull = room.players.length >= room.maxPlayers;
                  const isUnlocking = unlockingRoomId === room.id;

                  return (
                    <div key={room.id}>
                      <div className="relative flex items-center justify-between px-3 py-2.5 hover:bg-table-800/50 hover:pl-4 transition-all duration-200 group">
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gold-500/0 group-hover:bg-gold-500/60 transition-all duration-200" />
                        <div className="flex-1 min-w-0 mr-3">
                          <div className="text-white text-sm font-medium truncate flex items-center gap-1.5">
                            {room.isPrivate && <span className="text-xs text-gold-400" title="Private room">🔒</span>}
                            {room.name}
                          </div>
                          <div className="text-white/50 text-xs">
                            {room.players.find(p => p.isHost)?.name || 'Unknown'} · {room.players.length}/{room.maxPlayers} players
                          </div>
                        </div>
                        {room.isPrivate ? (
                          <button
                            onClick={() => toggleUnlock(room.id)}
                            disabled={!isConnected || isLoading || !playerName.trim() || isFull}
                            className={cn(
                              'px-3 py-2 rounded-md text-xs font-medium transition-all shrink-0 min-w-[52px]',
                              !isFull && playerName.trim()
                                ? isUnlocking
                                  ? 'bg-gold-500 text-table-950'
                                  : 'bg-gold-500/80 hover:bg-gold-400 text-table-950'
                                : 'bg-table-700 text-white/30 cursor-not-allowed'
                            )}
                          >
                            {isFull ? 'Full' : isUnlocking ? 'Cancel' : 'Enter Code'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleJoinPublic(room.code)}
                            disabled={!isConnected || isLoading || !playerName.trim() || isFull}
                            className={cn(
                              'px-3 py-2 rounded-md text-xs font-medium transition-all shrink-0 min-w-[52px]',
                              !isFull && playerName.trim()
                                ? 'bg-gold-500 hover:bg-gold-400 text-table-950'
                                : 'bg-table-700 text-white/30 cursor-not-allowed'
                            )}
                          >
                            {isFull ? 'Full' : 'Join'}
                          </button>
                        )}
                      </div>

                      {isUnlocking && (
                        <form onSubmit={handleJoinPrivate} className="px-3 pb-2.5">
                          <div className="flex gap-2">
                            <input
                              autoFocus
                              placeholder="Enter 6-char code"
                              value={codeInput}
                              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                              maxLength={6}
                              className="flex-1 px-2 py-1 bg-table-800 border border-table-600 rounded-md text-white text-xs font-mono tracking-widest text-center uppercase focus:outline-none focus:ring-1 focus:ring-gold-500"
                            />
                            <button
                              type="submit"
                              disabled={codeInput.length !== 6}
                              className={cn(
                                'px-3 py-1 rounded-md text-xs font-medium transition-all shrink-0',
                                codeInput.length === 6
                                  ? 'bg-gold-500 hover:bg-gold-400 text-table-950'
                                  : 'bg-table-700 text-white/30 cursor-not-allowed'
                              )}
                            >
                              Join
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

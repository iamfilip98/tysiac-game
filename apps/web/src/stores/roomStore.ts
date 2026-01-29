import { create } from 'zustand';
import type { Room, RoomPlayer } from '@tysiac/shared';

interface RoomState {
  room: Room | null;
  playerId: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;

  // Actions
  setRoom: (room: Room | null) => void;
  setPlayerId: (id: string) => void;
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setError: (error: string | null) => void;
  updatePlayer: (playerId: string, updates: Partial<RoomPlayer>) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  room: null,
  playerId: null,
  isConnected: false,
  isConnecting: false,
  error: null,

  setRoom: (room) => set({ room, error: null }),
  setPlayerId: (playerId) => set({ playerId }),
  setConnected: (isConnected) => set({ isConnected }),
  setConnecting: (isConnecting) => set({ isConnecting }),
  setError: (error) => set({ error }),

  updatePlayer: (playerId, updates) =>
    set((state) => {
      if (!state.room) return state;

      const players = state.room.players.map((p) =>
        p.id === playerId ? { ...p, ...updates } : p
      );

      return { room: { ...state.room, players } };
    }),

  reset: () =>
    set({
      room: null,
      playerId: null,
      isConnected: false,
      isConnecting: false,
      error: null,
    }),
}));

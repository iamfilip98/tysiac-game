import { create } from 'zustand';
import type { Room, RoomPlayer } from '@tysiac/shared';

interface RoomState {
  room: Room | null;
  playerId: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  isCreatingRoom: boolean;
  error: string | null;
  publicRooms: Room[];

  // Actions
  setRoom: (room: Room | null) => void;
  setPlayerId: (id: string) => void;
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setCreatingRoom: (creating: boolean) => void;
  setError: (error: string | null) => void;
  setPublicRooms: (rooms: Room[]) => void;
  updatePlayer: (playerId: string, updates: Partial<RoomPlayer>) => void;
  clearRoom: () => void;
  reset: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  room: null,
  playerId: null,
  isConnected: false,
  isConnecting: false,
  isCreatingRoom: false,
  error: null,
  publicRooms: [],

  setRoom: (room) => set({ room, error: null }),
  setPlayerId: (playerId) => set({ playerId }),
  setConnected: (isConnected) => set({ isConnected }),
  setConnecting: (isConnecting) => set({ isConnecting }),
  setCreatingRoom: (isCreatingRoom) => set({ isCreatingRoom }),
  setError: (error) => set({ error }),
  setPublicRooms: (publicRooms) => set({ publicRooms }),

  updatePlayer: (playerId, updates) =>
    set((state) => {
      if (!state.room) return state;

      const players = state.room.players.map((p) =>
        p.id === playerId ? { ...p, ...updates } : p
      );

      return { room: { ...state.room, players } };
    }),

  clearRoom: () =>
    set({
      room: null,
      playerId: null,
      error: null,
    }),

  reset: () =>
    set({
      room: null,
      playerId: null,
      isConnected: false,
      isConnecting: false,
      isCreatingRoom: false,
      error: null,
      publicRooms: [],
    }),
}));

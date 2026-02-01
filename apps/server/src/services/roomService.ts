import { nanoid } from 'nanoid';
import type { Room, RoomPlayer } from '@tysiac/shared';

// AI player names pool
const AI_NAMES = [
  'Bartek',
  'Kasia',
  'Michał',
  'Ania',
  'Piotr',
  'Magda',
  'Janek',
  'Zosia',
  'Marek',
  'Basia',
];

// In-memory room storage (for simplicity; can be backed by DB)
const rooms = new Map<string, Room>();
const playerRooms = new Map<string, string>(); // playerId -> roomId

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function createRoom(hostId: string, hostName: string, roomName: string, isPrivate: boolean, maxPlayers: 3 | 4 = 3): Room {
  const id = nanoid();
  let code = generateRoomCode();

  // Ensure unique code
  while (Array.from(rooms.values()).some(r => r.code === code)) {
    code = generateRoomCode();
  }

  const room: Room = {
    id,
    code,
    name: roomName,
    hostId,
    players: [
      {
        id: hostId,
        name: hostName,
        isReady: false,
        isHost: true,
        isAI: false,
      },
    ],
    maxPlayers,
    isPrivate,
    gameId: null,
    createdAt: Date.now(),
  };

  rooms.set(id, room);
  playerRooms.set(hostId, id);

  return room;
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function getRoomByCode(code: string): Room | undefined {
  return Array.from(rooms.values()).find(r => r.code === code.toUpperCase());
}

export function getRoomByPlayerId(playerId: string): Room | undefined {
  const roomId = playerRooms.get(playerId);
  return roomId ? rooms.get(roomId) : undefined;
}

export function getPublicRooms(): Room[] {
  return Array.from(rooms.values()).filter(r => !r.isPrivate && !r.gameId && r.players.length < r.maxPlayers);
}

export function joinRoom(roomId: string, playerId: string, playerName: string): Room | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  if (room.players.length >= room.maxPlayers) return null;
  if (room.gameId) return null; // Game already started
  if (room.players.some(p => p.id === playerId)) return room; // Already in room

  room.players.push({
    id: playerId,
    name: playerName,
    isReady: false,
    isHost: false,
    isAI: false,
  });

  playerRooms.set(playerId, roomId);
  return room;
}

export function leaveRoom(playerId: string): { room: Room | null; wasDeleted: boolean } {
  const roomId = playerRooms.get(playerId);
  if (!roomId) return { room: null, wasDeleted: false };

  const room = rooms.get(roomId);
  if (!room) {
    playerRooms.delete(playerId);
    return { room: null, wasDeleted: false };
  }

  // Remove player
  room.players = room.players.filter(p => p.id !== playerId);
  playerRooms.delete(playerId);

  // If room is empty, delete it
  if (room.players.length === 0) {
    rooms.delete(roomId);
    return { room: null, wasDeleted: true };
  }

  // If host left, assign new host
  if (room.hostId === playerId) {
    const newHost = room.players.find(p => !p.isAI);
    if (newHost) {
      room.hostId = newHost.id;
      newHost.isHost = true;
    } else {
      // All remaining are AI, delete room
      room.players.forEach(p => playerRooms.delete(p.id));
      rooms.delete(roomId);
      return { room: null, wasDeleted: true };
    }
  }

  return { room, wasDeleted: false };
}

export function setPlayerReady(playerId: string, isReady: boolean): Room | null {
  const room = getRoomByPlayerId(playerId);
  if (!room) return null;

  const player = room.players.find(p => p.id === playerId);
  if (player) {
    player.isReady = isReady;
  }

  return room;
}

export function addAI(roomId: string): Room | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  if (room.players.length >= room.maxPlayers) return null;

  const aiId = `ai-${nanoid(8)}`;

  // Get names already used in this room
  const usedNames = new Set(room.players.map(p => p.name));

  // Filter available names and pick a random one
  const availableNames = AI_NAMES.filter(name => !usedNames.has(name));
  const randomName = availableNames[Math.floor(Math.random() * availableNames.length)] || 'AI';

  room.players.push({
    id: aiId,
    name: randomName,
    isReady: true, // AI is always ready
    isHost: false,
    isAI: true,
  });

  playerRooms.set(aiId, roomId);
  return room;
}

export function removeAI(roomId: string, aiId: string): Room | null {
  const room = rooms.get(roomId);
  if (!room) return null;

  const aiPlayer = room.players.find(p => p.id === aiId && p.isAI);
  if (!aiPlayer) return null;

  room.players = room.players.filter(p => p.id !== aiId);
  playerRooms.delete(aiId);

  return room;
}

export function canStartGame(room: Room): boolean {
  if (room.players.length !== room.maxPlayers) return false;
  if (room.gameId) return false;

  // All human players must be ready
  const humanPlayers = room.players.filter(p => !p.isAI);
  return humanPlayers.every(p => p.isReady);
}

export function setGameId(roomId: string, gameId: string): void {
  const room = rooms.get(roomId);
  if (room) {
    room.gameId = gameId;
  }
}

export function clearGameId(roomId: string): void {
  const room = rooms.get(roomId);
  if (room) {
    room.gameId = null;
    // Reset ready state
    room.players.forEach(p => {
      if (!p.isAI) p.isReady = false;
    });
  }
}

export function setPreviousWinner(roomId: string, winnerId: string): void {
  const room = rooms.get(roomId);
  if (room) {
    room.previousWinner = winnerId;
  }
}

export function clearPreviousWinner(roomId: string): void {
  const room = rooms.get(roomId);
  if (room) {
    room.previousWinner = null;
  }
}

export function replacePlayerWithAI(roomId: string, playerId: string): Room | null {
  const room = rooms.get(roomId);
  if (!room) return null;

  const player = room.players.find(p => p.id === playerId);
  if (!player) return null;

  // Mark player as AI (keeping their name with [AI] suffix)
  player.isAI = true;
  player.name = `${player.name} [AI]`;
  player.isReady = true;

  // Remove from player rooms mapping (they're no longer connected)
  playerRooms.delete(playerId);

  // If they were host, transfer host to another human player
  if (room.hostId === playerId) {
    const newHost = room.players.find(p => !p.isAI);
    if (newHost) {
      room.hostId = newHost.id;
      newHost.isHost = true;
      player.isHost = false;
    }
  }

  return room;
}

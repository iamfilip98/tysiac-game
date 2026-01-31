import type { Card, Suit } from './cards.js';
import type { GameState, GamePlayer, GamePhase } from './game.js';

// Room types
export interface Room {
  id: string;
  code: string; // 6-character join code
  name: string;
  hostId: string;
  players: RoomPlayer[];
  maxPlayers: 3 | 4;
  isPrivate: boolean;
  gameId: string | null;
  createdAt: number;
}

export interface RoomPlayer {
  id: string;
  name: string;
  isReady: boolean;
  isHost: boolean;
  isAI: boolean;
}

// Client -> Server events
export interface ClientToServerEvents {
  // Room events
  'room:create': (data: { playerName: string; roomName: string; isPrivate: boolean; maxPlayers?: 3 | 4 }) => void;
  'room:join': (data: { playerName: string; roomCode: string }) => void;
  'room:leave': () => void;
  'room:ready': (isReady: boolean) => void;
  'room:addAI': () => void;
  'room:removeAI': (aiId: string) => void;
  'room:startGame': () => void;

  // Game events
  'game:bid': (amount: number) => void;
  'game:pass': () => void;
  'game:confirmTalon': () => void;
  'game:distributeTalon': (distribution: { playerId: string; card: Card }[]) => void;
  'game:playCard': (card: Card) => void;
  'game:declareMarriage': (suit: Suit) => void;

  // Connection events
  'player:reconnect': (data: { roomId: string; playerId: string; sessionToken: string }) => void;
}

// Server -> Client events
export interface ServerToClientEvents {
  // Room events
  'room:created': (data: Room & { sessionToken: string }) => void;
  'room:joined': (data: { room: Room; playerId: string; sessionToken: string }) => void;
  'room:updated': (room: Room) => void;
  'room:playerJoined': (player: RoomPlayer) => void;
  'room:playerLeft': (playerId: string) => void;
  'room:error': (error: { code: string; message: string }) => void;

  // Game events
  'game:started': (gameState: ClientGameState) => void;
  'game:stateUpdate': (gameState: ClientGameState) => void;
  'game:phaseChange': (phase: GamePhase) => void;
  'game:yourTurn': (data: { validActions: ValidAction[] }) => void;
  'game:cardPlayed': (data: { playerId: string; card: Card }) => void;
  'game:trickWon': (data: { winnerId: string; cards: Card[]; points: number }) => void;
  'game:roundEnd': (data: RoundResult) => void;
  'game:ended': (data: { winnerId: string; finalScores: Record<string, number> }) => void;
  'game:error': (error: { code: string; message: string }) => void;

  // Connection events
  'connection:restored': (data: { room: Room; gameState: ClientGameState | null }) => void;
  'player:disconnected': (playerId: string) => void;
  'player:reconnected': (playerId: string) => void;

  // Lobby events
  'lobby:roomList': (rooms: Room[]) => void;
}

// Valid actions a player can take
export type ValidAction =
  | { type: 'bid'; minBid: number; maxBid: number }
  | { type: 'pass' }
  | { type: 'playCard'; validCards: Card[] }
  | { type: 'distributeTalon'; cardsToGive: number }
  | { type: 'declareMarriage'; suits: Suit[] };

// Client game state (with hidden information removed)
export interface ClientGameState {
  id: string;
  roomId: string;
  phase: GamePhase;
  players: GamePlayer[];
  scores: Record<string, { totalScore: number; roundScores: number[]; isOnBarrel: boolean }>;

  // Current round info
  round: {
    roundNumber: number;
    dealer: string;
    trumpSuit: Suit | null;
    bidWinner: string | null;
    finalBid: number;
    currentTrick: {
      cards: { playerId: string; card: Card }[];
      leadSuit: Suit | null;
      currentPlayer: string;
      trickNumber: number;
    } | null;
    completedTricks: number;
    playerTrickCounts: Record<string, number>;
    declaredMarriages: Record<string, Suit[]>;
  } | null;

  // Player's own hand
  myHand: Card[];

  // Whether player is spectating (dealer in 4-player mode)
  isSpectating?: boolean;

  // Talon info (only visible during appropriate phases)
  talon: Card[] | null;

  // For talon distribution phase
  cardsToDistribute: Card[] | null;

  // Winner (if game ended)
  winner: string | null;
}

// Round result for scoring display
export interface RoundResult {
  roundNumber: number;
  bidWinner: string;
  bid: number;
  bidderMadeBid: boolean;
  playerResults: {
    playerId: string;
    trickPoints: number;
    marriagePoints: number;
    totalRoundPoints: number;
    scoreChange: number;
    newTotalScore: number;
    wasOnBarrel: boolean;
    fellOffBarrel: boolean;
    isDealer?: boolean;
    sittingOut?: boolean;
  }[];
}

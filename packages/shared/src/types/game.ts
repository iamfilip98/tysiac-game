import type { Card, Suit } from './cards.js';

// Game constants
export const WINNING_SCORE = 1000;
export const BARREL_THRESHOLD = 800;
export const MIN_BID = 100;
export const BID_INCREMENT = 10;
export const INITIAL_MIN_BID = 110; // First bid after auto-100

// Player in a game
export interface GamePlayer {
  id: string;
  name: string;
  isAI: boolean;
  seatIndex: number; // 0, 1, or 2
}

// Player's hand and state during a round
export interface PlayerRoundState {
  playerId: string;
  hand: Card[];
  tricksWon: Card[][]; // Cards won in tricks
  pointsFromTricks: number;
  declaredMarriages: Suit[];
  marriagePoints: number;
}

// Bidding state
export interface BiddingState {
  currentBidder: string; // Player ID
  currentBid: number;
  highestBidder: string | null;
  passedPlayers: string[]; // Players who have passed
  biddingOrder: string[]; // Order of bidding (left of dealer first)
}

// Current trick state
export interface TrickState {
  cards: { playerId: string; card: Card }[];
  leadSuit: Suit | null;
  currentPlayer: string;
  trickNumber: number; // 1-8
}

// Round state
export interface RoundState {
  roundNumber: number;
  dealer: string; // Player ID
  talon: Card[];
  talonRevealed: boolean;
  trumpSuit: Suit | null;
  bidWinner: string | null;
  finalBid: number;
  players: Record<string, PlayerRoundState>;
  currentTrick: TrickState | null;
  completedTricks: number;
  cardsToDistribute: Card[]; // Cards bidder gives away
  // 4-player mode fields
  isDealerSittingOut: boolean;
  dealerMarriagePoints: number;
  talonMarriages: Suit[];
}

// Player scores
export interface PlayerScore {
  playerId: string;
  totalScore: number;
  roundScores: number[];
  isOnBarrel: boolean;
  barrelAttempts: number; // Count of attempts while on barrel (max 3)
}

// Game phases/states
export type GamePhase =
  | 'idle'
  | 'dealing'
  | 'bidding'
  | 'talonReveal'
  | 'talonDistribution'
  | 'trickPlaying'
  | 'roundScoring'
  | 'gameEnd';

// Full game state
export interface GameState {
  id: string;
  roomId: string;
  phase: GamePhase;
  players: GamePlayer[];
  scores: Record<string, PlayerScore>;
  currentRound: RoundState | null;
  winner: string | null; // Player ID of winner
  createdAt: number;
  updatedAt: number;
}

// Initial player score
export function createInitialScore(playerId: string): PlayerScore {
  return {
    playerId,
    totalScore: 0,
    roundScores: [],
    isOnBarrel: false,
    barrelAttempts: 0,
  };
}

// Check if player is on barrel
export function isOnBarrel(score: number): boolean {
  return score >= BARREL_THRESHOLD && score < WINNING_SCORE;
}

// Get max bid based on marriages in hand
export function getMaxBid(marriageValue: number): number {
  return 120 + marriageValue;
}

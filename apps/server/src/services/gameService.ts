import { nanoid } from 'nanoid';
import type {
  GameState,
  GamePlayer,
  PlayerScore,
} from '@tysiac/shared';

// In-memory game storage
const games = new Map<string, GameState>();

export function createGame(roomId: string, players: { id: string; name: string; isAI: boolean }[]): GameState {
  const id = nanoid();

  const gamePlayers: GamePlayer[] = players.map((p, index) => ({
    id: p.id,
    name: p.name,
    isAI: p.isAI,
    seatIndex: index,
  }));

  const scores: Record<string, PlayerScore> = {};
  gamePlayers.forEach(p => {
    scores[p.id] = {
      playerId: p.id,
      totalScore: 0,
      roundScores: [],
      isOnBarrel: false,
      barrelAttempts: 0,
    };
  });

  const game: GameState = {
    id,
    roomId,
    phase: 'idle',
    players: gamePlayers,
    scores,
    currentRound: null,
    winner: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  games.set(id, game);
  return game;
}

export function getGame(gameId: string): GameState | undefined {
  return games.get(gameId);
}

export function updateGame(game: GameState): void {
  game.updatedAt = Date.now();
  games.set(game.id, game);
}

export function deleteGame(gameId: string): void {
  games.delete(gameId);
}

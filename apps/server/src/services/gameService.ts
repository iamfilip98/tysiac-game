import { nanoid } from 'nanoid';
import type {
  GameState,
  GamePlayer,
  RoundState,
  PlayerRoundState,
  PlayerScore,
  BiddingState,
  TrickState,
  Card,
  Suit,
  createInitialScore
} from '@tysiac/shared';
import { createDeck, shuffleDeck, SUITS } from '@tysiac/shared';

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

export function startNewRound(game: GameState): void {
  const roundNumber = game.currentRound ? game.currentRound.roundNumber + 1 : 1;

  // Dealer rotates each round
  const dealerIndex = (roundNumber - 1) % 3;
  const dealer = game.players[dealerIndex];

  // Create and shuffle deck
  const deck = shuffleDeck(createDeck());

  // Deal cards: 7 to each player, 3 to talon
  const hands: Card[][] = [[], [], []];
  for (let i = 0; i < 21; i++) {
    hands[i % 3].push(deck[i]);
  }
  const talon = deck.slice(21, 24);

  // Create player round states
  const playerStates: Record<string, PlayerRoundState> = {};
  game.players.forEach((p, index) => {
    playerStates[p.id] = {
      playerId: p.id,
      hand: hands[index],
      tricksWon: [],
      pointsFromTricks: 0,
      declaredMarriages: [],
      marriagePoints: 0,
    };
  });

  game.currentRound = {
    roundNumber,
    dealer: dealer.id,
    talon,
    talonRevealed: false,
    trumpSuit: null,
    bidWinner: null,
    finalBid: 0,
    players: playerStates,
    currentTrick: null,
    completedTricks: 0,
    cardsToDistribute: [],
  };

  game.phase = 'dealing';
  updateGame(game);
}

export function getPlayerHand(game: GameState, playerId: string): Card[] {
  if (!game.currentRound) return [];
  return game.currentRound.players[playerId]?.hand || [];
}

export function getBiddingState(game: GameState): BiddingState | null {
  if (!game.currentRound || game.phase !== 'bidding') return null;

  const round = game.currentRound;
  const dealerIndex = game.players.findIndex(p => p.id === round.dealer);

  // Bidding starts left of dealer
  const biddingOrder = [
    game.players[(dealerIndex + 1) % 3].id,
    game.players[(dealerIndex + 2) % 3].id,
    round.dealer,
  ];

  return {
    currentBidder: biddingOrder[0], // Will be updated as bidding progresses
    currentBid: round.finalBid || 100,
    highestBidder: round.bidWinner,
    passedPlayers: [],
    biddingOrder,
  };
}

export function getNextBidder(game: GameState, passedPlayers: string[]): string | null {
  if (!game.currentRound) return null;

  const round = game.currentRound;
  const dealerIndex = game.players.findIndex(p => p.id === round.dealer);

  const biddingOrder = [
    game.players[(dealerIndex + 1) % 3].id,
    game.players[(dealerIndex + 2) % 3].id,
    round.dealer,
  ];

  // Find next active bidder
  for (const playerId of biddingOrder) {
    if (!passedPlayers.includes(playerId) && playerId !== round.bidWinner) {
      return playerId;
    }
  }

  return null;
}

export function getCurrentTrickPlayer(game: GameState): string | null {
  if (!game.currentRound?.currentTrick) return null;
  return game.currentRound.currentTrick.currentPlayer;
}

export function removeCardsFromHand(game: GameState, playerId: string, cards: Card[]): void {
  if (!game.currentRound) return;

  const playerState = game.currentRound.players[playerId];
  if (!playerState) return;

  playerState.hand = playerState.hand.filter(handCard =>
    !cards.some(c => c.suit === handCard.suit && c.rank === handCard.rank)
  );

  updateGame(game);
}

export function addCardsToHand(game: GameState, playerId: string, cards: Card[]): void {
  if (!game.currentRound) return;

  const playerState = game.currentRound.players[playerId];
  if (!playerState) return;

  playerState.hand.push(...cards);
  updateGame(game);
}

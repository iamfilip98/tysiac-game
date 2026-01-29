import { createMachine, assign } from 'xstate';
import type { GameState, Card, Suit, RoundResult } from '@tysiac/shared';

// Context for the state machine
export interface GameMachineContext {
  game: GameState;
  biddingState: {
    currentBidder: string;
    currentBid: number;
    highestBidder: string | null;
    passedPlayers: string[];
    isFirstBid: boolean;
  };
  trickState: {
    currentPlayer: string;
    cardsPlayed: { playerId: string; card: Card }[];
    leadSuit: Suit | null;
    trickNumber: number;
  };
  pendingMarriage: Suit | null;
  roundResult: RoundResult | null;
}

// Input type for the machine
export interface GameMachineInput {
  game: GameState;
}

// Events
export type GameMachineEvent =
  | { type: 'START_GAME' }
  | { type: 'DEAL_COMPLETE' }
  | { type: 'BID'; playerId: string; amount: number }
  | { type: 'PASS'; playerId: string }
  | { type: 'ALL_PASSED' }
  | { type: 'BIDDING_COMPLETE'; winnerId: string; bid: number }
  | { type: 'TALON_PICKED' }
  | { type: 'DISTRIBUTION_COMPLETE' }
  | { type: 'PLAY_CARD'; playerId: string; card: Card }
  | { type: 'DECLARE_MARRIAGE'; playerId: string; suit: Suit }
  | { type: 'TRICK_COMPLETE'; winnerId: string }
  | { type: 'ALL_TRICKS_COMPLETE' }
  | { type: 'SCORING_COMPLETE'; hasWinner: boolean }
  | { type: 'NEXT_ROUND' }
  | { type: 'GAME_OVER' };

export const gameMachine = createMachine({
  id: 'tysiacGame',
  initial: 'idle',
  types: {} as {
    context: GameMachineContext;
    events: GameMachineEvent;
    input: GameMachineInput;
  },
  context: ({ input }: { input: GameMachineInput }) => ({
    game: input.game,
    biddingState: {
      currentBidder: '',
      currentBid: 100,
      highestBidder: null,
      passedPlayers: [],
      isFirstBid: true,
    },
    trickState: {
      currentPlayer: '',
      cardsPlayed: [],
      leadSuit: null,
      trickNumber: 1,
    },
    pendingMarriage: null,
    roundResult: null,
  }),
  states: {
    idle: {
      on: {
        START_GAME: {
          target: 'dealing',
        },
      },
    },

    dealing: {
      entry: ['dealCards'],
      on: {
        DEAL_COMPLETE: {
          target: 'bidding',
          actions: ['initializeBidding'],
        },
      },
    },

    bidding: {
      on: {
        BID: {
          actions: ['processBid'],
          target: 'bidding',
          reenter: true,
        },
        PASS: {
          actions: ['processPass'],
          target: 'bidding',
          reenter: true,
        },
        BIDDING_COMPLETE: {
          target: 'talonReveal',
          actions: ['setBidWinner'],
        },
        ALL_PASSED: {
          target: 'talonReveal',
          actions: ['setForcedBidder'],
        },
      },
    },

    talonReveal: {
      entry: ['revealTalon'],
      on: {
        TALON_PICKED: {
          target: 'talonDistribution',
        },
      },
    },

    talonDistribution: {
      on: {
        DISTRIBUTION_COMPLETE: {
          target: 'trickPlaying',
          actions: ['initializeTrickPlay'],
        },
      },
    },

    trickPlaying: {
      on: {
        DECLARE_MARRIAGE: {
          actions: ['processMarriage'],
        },
        PLAY_CARD: {
          actions: ['processCardPlay'],
        },
        TRICK_COMPLETE: {
          actions: ['completeTrick'],
          target: 'trickPlaying',
          reenter: true,
        },
        ALL_TRICKS_COMPLETE: {
          target: 'roundScoring',
        },
      },
    },

    roundScoring: {
      entry: ['calculateScores'],
      on: {
        SCORING_COMPLETE: [
          {
            guard: ({ event }) => event.hasWinner,
            target: 'gameEnd',
          },
          {
            target: 'dealing',
            actions: ['prepareNextRound'],
          },
        ],
      },
    },

    gameEnd: {
      type: 'final',
      entry: ['finalizeGame'],
    },
  },
});

// Action implementations (to be provided by the engine)
export const machineActions = {
  dealCards: assign(({ context }) => {
    context.game.phase = 'dealing';
    return context;
  }),

  initializeBidding: assign(({ context }) => {
    const { game } = context;
    const round = game.currentRound!;
    const dealerIndex = game.players.findIndex((p: { id: string }) => p.id === round.dealer);

    // Left of dealer bids first (auto-100)
    const firstBidder = game.players[(dealerIndex + 1) % 3].id;

    context.biddingState = {
      currentBidder: firstBidder,
      currentBid: 100,
      highestBidder: firstBidder, // Auto-100
      passedPlayers: [],
      isFirstBid: false, // After auto-100
    };

    round.bidWinner = firstBidder;
    round.finalBid = 100;
    game.phase = 'bidding';

    // Move to next bidder (first one to actually bid starts at 110)
    context.biddingState.currentBidder = game.players[(dealerIndex + 2) % 3].id;

    return context;
  }),

  processBid: assign(({ context, event }) => {
    if (event.type !== 'BID') return context;

    const { playerId, amount } = event;
    const { biddingState } = context;

    biddingState.currentBid = amount;
    biddingState.highestBidder = playerId;
    biddingState.isFirstBid = false;

    // Update game state
    context.game.currentRound!.bidWinner = playerId;
    context.game.currentRound!.finalBid = amount;

    return context;
  }),

  processPass: assign(({ context, event }) => {
    if (event.type !== 'PASS') return context;

    const { playerId } = event;
    context.biddingState.passedPlayers.push(playerId);

    return context;
  }),

  setBidWinner: assign(({ context, event }) => {
    if (event.type !== 'BIDDING_COMPLETE') return context;

    const { winnerId, bid } = event;
    context.game.currentRound!.bidWinner = winnerId;
    context.game.currentRound!.finalBid = bid;

    return context;
  }),

  setForcedBidder: assign(({ context }) => {
    // Player left of dealer is forced at 100
    const { game } = context;
    const round = game.currentRound!;
    const dealerIndex = game.players.findIndex((p: { id: string }) => p.id === round.dealer);
    const forcedBidder = game.players[(dealerIndex + 1) % 3].id;

    round.bidWinner = forcedBidder;
    round.finalBid = 100;

    return context;
  }),

  revealTalon: assign(({ context }) => {
    context.game.phase = 'talonReveal';
    context.game.currentRound!.talonRevealed = true;
    return context;
  }),

  initializeTrickPlay: assign(({ context }) => {
    const { game } = context;
    game.phase = 'trickPlaying';

    const bidWinner = game.currentRound!.bidWinner!;

    context.trickState = {
      currentPlayer: bidWinner,
      cardsPlayed: [],
      leadSuit: null,
      trickNumber: 1,
    };

    game.currentRound!.currentTrick = {
      cards: [],
      leadSuit: null,
      currentPlayer: bidWinner,
      trickNumber: 1,
    };

    return context;
  }),

  processMarriage: assign(({ context, event }) => {
    if (event.type !== 'DECLARE_MARRIAGE') return context;

    const { playerId, suit } = event;
    const round = context.game.currentRound!;
    const playerState = round.players[playerId];

    playerState.declaredMarriages.push(suit);
    playerState.marriagePoints += suit === 'clubs' ? 40 : suit === 'diamonds' ? 60 : suit === 'hearts' ? 80 : 100;

    // Set trump
    round.trumpSuit = suit;

    return context;
  }),

  processCardPlay: assign(({ context, event }) => {
    if (event.type !== 'PLAY_CARD') return context;

    const { playerId, card } = event;
    const { trickState } = context;
    const round = context.game.currentRound!;

    // Add card to trick
    trickState.cardsPlayed.push({ playerId, card });
    round.currentTrick!.cards.push({ playerId, card });

    // Set lead suit if first card
    if (trickState.cardsPlayed.length === 1) {
      trickState.leadSuit = card.suit;
      round.currentTrick!.leadSuit = card.suit;
    }

    // Remove card from hand
    const playerState = round.players[playerId];
    playerState.hand = playerState.hand.filter(
      (c: Card) => !(c.suit === card.suit && c.rank === card.rank)
    );

    return context;
  }),

  completeTrick: assign(({ context, event }) => {
    if (event.type !== 'TRICK_COMPLETE') return context;

    const { winnerId } = event;
    const { trickState } = context;
    const round = context.game.currentRound!;

    // Award cards to winner
    const trickCards = trickState.cardsPlayed.map((p: { playerId: string; card: Card }) => p.card);
    round.players[winnerId].tricksWon.push(trickCards);

    // Calculate points
    const points = trickCards.reduce((sum: number, c: Card) => {
      const cardPoints: Record<string, number> = { '9': 0, 'J': 2, 'Q': 3, 'K': 4, '10': 10, 'A': 11 };
      return sum + cardPoints[c.rank];
    }, 0);
    round.players[winnerId].pointsFromTricks += points;

    round.completedTricks++;

    // Reset for next trick
    trickState.cardsPlayed = [];
    trickState.leadSuit = null;
    trickState.currentPlayer = winnerId;
    trickState.trickNumber++;

    if (round.completedTricks < 7) {
      round.currentTrick = {
        cards: [],
        leadSuit: null,
        currentPlayer: winnerId,
        trickNumber: trickState.trickNumber,
      };
    } else {
      round.currentTrick = null;
    }

    return context;
  }),

  calculateScores: assign(({ context }) => {
    context.game.phase = 'roundScoring';
    // Scoring logic handled by engine
    return context;
  }),

  prepareNextRound: assign(({ context }) => {
    // Reset for next round
    context.biddingState = {
      currentBidder: '',
      currentBid: 100,
      highestBidder: null,
      passedPlayers: [],
      isFirstBid: true,
    };
    context.trickState = {
      currentPlayer: '',
      cardsPlayed: [],
      leadSuit: null,
      trickNumber: 1,
    };
    context.pendingMarriage = null;
    context.roundResult = null;

    return context;
  }),

  finalizeGame: assign(({ context }) => {
    context.game.phase = 'gameEnd';
    return context;
  }),
};

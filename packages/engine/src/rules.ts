import type { Rank, Suit } from './types';

/** Every rule number in one place (spec §3). Used by engine, rules page and coach. */
export const RULES = {
  suits: ['clubs', 'diamonds', 'hearts', 'spades'],
  ranks: ['9', '10', 'J', 'Q', 'K', 'A'],
  cardPoints: { '9': 0, J: 2, Q: 3, K: 4, '10': 10, A: 11 },
  rankStrength: { '9': 0, J: 1, Q: 2, K: 3, '10': 4, A: 5 },
  marriageValues: { hearts: 100, diamonds: 80, clubs: 60, spades: 40 },
  /** Marriage search order (highest value first) — also "first marriage found" for wykładana trump. */
  marriageOrder: ['hearts', 'diamonds', 'clubs', 'spades'],
  pointsPerRound: 120,
  handSize: 7,
  talonSize: 3,
  tricksPerRound: 8,
  /** Redeal while any active hand has fewer points than this and no marriage. */
  redealBelow: 18,
  autoBid: 100,
  bidStep: 10,
  maxBidBase: 120,
  /** Throw-in above 100: this pool is split equally among the other active players. */
  throwPool: 120,
  barrelAt: 800,
  winAt: 1000,
  /** roundToTen: remainder >= this rounds up. */
  roundUpFrom: 6,
  /** 4 players: sitting-out dealer gets this per ace in the talon. */
  talonAcePoints: 50,
} as const;

export const SUITS: readonly Suit[] = RULES.suits;
export const RANKS: readonly Rank[] = RULES.ranks;

export const SUIT_SYMBOL: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

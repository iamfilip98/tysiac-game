// Public types of @tysiac/engine. Everything here is JSON-serializable.

export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';
export type Rank = '9' | '10' | 'J' | 'Q' | 'K' | 'A';
export interface Card {
  suit: Suit;
  rank: Rank;
}
export type PlayerId = string;

/** A seat at the table, in clockwise order. `botFor` is room-level metadata the engine ignores. */
export interface Seat {
  id: PlayerId;
  name: string;
  avatar: string;
  isBot: boolean;
  botFor?: string;
}

/** Lobby and round-end screens are room/UI concerns: the engine deals round 1 in createGame and
 *  deals the next round in the same reduce call that scores the previous one. */
export type Phase = 'bidding' | 'talon' | 'decision' | 'handout' | 'tricks' | 'gameEnd';

export interface TrickCard {
  p: PlayerId;
  card: Card;
}

export interface BidState {
  /** Current high bidder (starts as the auto-100 player, first active player left of dealer). */
  high: PlayerId;
  amount: number;
  /** Whose turn it is to bid; null once bidding is over. */
  turn: PlayerId | null;
  passed: PlayerId[];
}

export interface CompletedTrick {
  cards: TrickCard[];
  winner: PlayerId;
  points: number;
}

export interface Round {
  number: number;
  dealer: PlayerId;
  /** The 3 players who play this round, clockwise starting left of the dealer. */
  active: PlayerId[];
  /** Hands of active players only. The bidder's hand includes the talon after bidding. */
  hands: Record<PlayerId, Card[]>;
  /** The 3 talon cards as dealt (kept for display and 4-player dealer scoring). */
  talon: Card[];
  /** true when the winning bid is > 100 (everyone saw the talon). */
  talonPublic: boolean;
  /** Seats that confirmed the public talon; the talon phase ends when every seat but the bidder is here. */
  talonSeen: PlayerId[];
  bid: BidState;
  trump: Suit | null;
  marriages: Record<PlayerId, Suit[]>;
  trick: { leader: PlayerId; cards: TrickCard[] };
  tricksWon: Record<PlayerId, Card[][]>;
  handoutGiven: Record<PlayerId, Card> | null;
  lastTrick: CompletedTrick | null;
}

export interface PlayerRoundResult {
  playerId: PlayerId;
  trickPoints: number;
  /** Counted marriage points (0 if no trick won); for a sitting-out dealer: the talon bonus. */
  marriagePoints: number;
  totalRoundPoints: number;
  scoreChange: number;
  newTotalScore: number;
  wasOnBarrel: boolean;
  fellOffBarrel: boolean;
  isDealer: boolean;
  sittingOut: boolean;
}

export interface RoundScoreResult {
  bidderMadeBid: boolean;
  playerScores: PlayerRoundResult[];
  winner: PlayerId | null;
}

export type RoundOutcome = 'made' | 'failed' | 'thrown';

export interface RoundSummary {
  number: number;
  dealer: PlayerId;
  bidder: PlayerId;
  bid: number;
  outcome: RoundOutcome;
  wykladana: boolean;
  /** One entry per seat, in seat order. */
  players: PlayerRoundResult[];
}

export interface PlayerScore {
  total: number;
  /** scoreChange of every finished round (including throw-ins, 0 when nothing changed). */
  history: number[];
}
export type Scores = Record<PlayerId, PlayerScore>;

export interface GameState {
  v: 1;
  /** Increments on every accepted action. */
  seq: number;
  /** Seeded RNG state (32 hex chars, sfc32). */
  rng: string;
  seats: Seat[];
  firstDealer: number;
  maxPlayers: 3 | 4;
  phase: Phase;
  round: Round | null;
  scores: Scores;
  rounds: RoundSummary[];
  paused: { by: PlayerId; at: number } | null;
  winner: PlayerId | null;
}

export type Action =
  | { type: 'bid'; amount: number }
  | { type: 'pass' }
  | { type: 'play' }
  | { type: 'throw' }
  | { type: 'ackTalon' }
  | { type: 'handout'; to: Record<PlayerId, Card> }
  | { type: 'card'; card: Card }
  | { type: 'pause' }
  | { type: 'resume' };

export type RuleErrorCode =
  | 'notSeated'
  | 'gameOver'
  | 'paused'
  | 'notYourTurn'
  | 'illegalCard'
  | 'badBid'
  | 'badHandout'
  | 'illegalAction';

export interface RuleError {
  code: RuleErrorCode;
  message: string;
}

export type Audience = 'all' | PlayerId[];

/**
 * Events emitted by `reduce`. Every round ends with exactly ONE of `threw` (a throw-in) or
 * `roundScored` (a played or wykładana round); both carry the round `summary`. A `gameWon` event may
 * follow it, and otherwise the next round's `dealt` event(s).
 */
export type GameEventBody =
  | { type: 'dealt'; round: number; dealer: PlayerId; active: PlayerId[]; hand: Card[] }
  | { type: 'bid'; p: PlayerId; amount: number }
  | { type: 'passed'; p: PlayerId }
  | { type: 'biddingWon'; p: PlayerId; amount: number; talonPublic: boolean }
  | { type: 'talonRevealed'; p: PlayerId; cards: Card[] }
  | { type: 'talonSeen'; p: PlayerId }
  | { type: 'threw'; p: PlayerId; amount: number; summary: RoundSummary }
  | { type: 'handedOut'; p: PlayerId; recipients: PlayerId[]; cards: Partial<Record<PlayerId, Card>> }
  | { type: 'wykladana'; p: PlayerId; hand: Card[]; trump: Suit | null; marriages: Suit[] }
  | { type: 'cardPlayed'; p: PlayerId; card: Card }
  | { type: 'marriage'; p: PlayerId; suit: Suit; points: number }
  | { type: 'trickWon'; p: PlayerId; cards: TrickCard[]; card: Card; points: number; byTrump: boolean }
  | { type: 'roundScored'; summary: RoundSummary }
  | { type: 'gameWon'; p: PlayerId; totals: Record<PlayerId, number> }
  | { type: 'paused'; p: PlayerId }
  | { type: 'resumed'; p: PlayerId };

export type GameEvent = GameEventBody & { audience: Audience };

export type ReduceResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: RuleError };

export interface RoundView {
  number: number;
  dealer: PlayerId;
  active: PlayerId[];
  sittingOut: PlayerId | null;
  /** The viewer's own hand ([] for a sitting-out dealer). */
  hand: Card[];
  handCounts: Record<PlayerId, number>;
  /** Talon cards when this viewer may see them, else null. */
  talon: Card[] | null;
  talonPublic: boolean;
  /** Seats that still have to confirm the public talon; [] outside the talon phase. */
  talonWaiting: PlayerId[];
  bid: BidState;
  /** Viewer's max bid (120 + marriages in hand); 0 when not active. */
  maxBid: number;
  trump: Suit | null;
  marriages: Record<PlayerId, Suit[]>;
  trick: { leader: PlayerId; cards: TrickCard[] };
  lastTrick: CompletedTrick | null;
  /** Cards of completed tricks this round (public). */
  played: Card[];
  tricksTaken: Record<PlayerId, number>;
  trickPoints: Record<PlayerId, number>;
  /** Bidder: every card given; recipient: only their own card; others: {}; null before hand-out. */
  handout: Partial<Record<PlayerId, Card>> | null;
}

export interface PlayerView {
  v: 1;
  seq: number;
  me: PlayerId;
  seats: Seat[];
  maxPlayers: 3 | 4;
  firstDealer: number;
  phase: Phase;
  paused: { by: PlayerId; at: number } | null;
  winner: PlayerId | null;
  scores: Scores;
  rounds: RoundSummary[];
  turn: PlayerId | null;
  legal: Action[];
  round: RoundView | null;
}

export interface Advice {
  action: Action;
  headline: string;
  reasons: string[];
}

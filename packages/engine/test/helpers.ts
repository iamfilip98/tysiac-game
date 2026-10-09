import type { BidState, Card, GameState, Phase, PlayerId, ReduceResult, Seat, Suit } from '../src/types';
import { parseCard, parseCards } from '../src/cards';
import { activeFor } from '../src/deal';
import { seedState } from '../src/rng';

export const SEATS3: Seat[] = [
  { id: 'a', name: 'Ala', avatar: '🦊', isBot: false },
  { id: 'b', name: 'Bartek', avatar: '🐻', isBot: false },
  { id: 'c', name: 'Celina', avatar: '🦉', isBot: false },
];

export const SEATS4: Seat[] = [...SEATS3, { id: 'd', name: 'Darek', avatar: '🐺', isBot: false }];

export const c = (text: string): Card => parseCard(text);

export function ok(result: ReduceResult): Extract<ReduceResult, { ok: true }> {
  if (!result.ok) throw new Error(`expected ok, got ${result.error.code}: ${result.error.message}`);
  return result;
}

export interface Scenario {
  seats?: Seat[];
  /** Default: last seat, so 3p active = [a, b, c] and 4p active = [a, b, c] with d sitting out. */
  dealer?: PlayerId;
  phase: Phase;
  hands: Record<PlayerId, string>;
  talon?: string;
  talonPublic?: boolean;
  bid?: Partial<BidState>;
  trump?: Suit | null;
  marriages?: Record<PlayerId, Suit[]>;
  trick?: { leader: PlayerId; cards: Array<[PlayerId, string]> };
  /** Each string is one won trick, e.g. 'AS 10S KS'. */
  tricksWon?: Record<PlayerId, string[]>;
  totals?: Record<PlayerId, number>;
  handoutGiven?: Record<PlayerId, string>;
  roundNumber?: number;
}

/** Builds a GameState at an arbitrary point of a round. Card conservation is NOT enforced. */
export function scenario(sc: Scenario): GameState {
  const seats = sc.seats ?? SEATS3;
  const ids = seats.map(s => s.id);
  const n = ids.length;
  const dealer = sc.dealer ?? ids[n - 1];
  const dealerIndex = ids.indexOf(dealer);
  const active = activeFor(ids, dealerIndex);
  const number = sc.roundNumber ?? 1;
  const high = sc.bid?.high ?? active[0];
  const bid: BidState = {
    high,
    amount: sc.bid?.amount ?? 100,
    turn: sc.bid?.turn !== undefined ? sc.bid.turn : sc.phase === 'bidding' ? active[1] : null,
    passed: sc.bid?.passed ?? [],
  };
  return {
    v: 1,
    seq: 0,
    rng: seedState('scenario'),
    seats: seats.map(s => ({ ...s })),
    firstDealer: (((dealerIndex - (number - 1)) % n) + n) % n,
    maxPlayers: n as 3 | 4,
    phase: sc.phase,
    round: {
      number,
      dealer,
      active,
      hands: Object.fromEntries(active.map(p => [p, parseCards(sc.hands[p] ?? '')])),
      talon: parseCards(sc.talon ?? ''),
      talonPublic: sc.talonPublic ?? false,
      bid,
      trump: sc.trump ?? null,
      marriages: Object.fromEntries(active.map(p => [p, [...(sc.marriages?.[p] ?? [])]])),
      trick: {
        leader: sc.trick?.leader ?? high,
        cards: (sc.trick?.cards ?? []).map(([p, card]) => ({ p, card: parseCard(card) })),
      },
      tricksWon: Object.fromEntries(active.map(p => [p, (sc.tricksWon?.[p] ?? []).map(t => parseCards(t))])),
      handoutGiven: sc.handoutGiven
        ? Object.fromEntries(Object.entries(sc.handoutGiven).map(([p, card]) => [p, parseCard(card)]))
        : null,
      lastTrick: null,
    },
    scores: Object.fromEntries(ids.map(id => [id, { total: sc.totals?.[id] ?? 0, history: [] }])),
    rounds: [],
    paused: null,
    winner: null,
  };
}

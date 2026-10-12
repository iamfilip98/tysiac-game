import type { Action, Card, GameState, PlayerId, Round } from './types';
import { RULES } from './rules';
import { cardEquals, isCard } from './cards';
import { maxBidFor } from './bidding';
import { getValidCards } from './tricks';

export function nextActive(active: readonly PlayerId[], p: PlayerId): PlayerId {
  const i = active.indexOf(p);
  return active[(i + 1) % active.length];
}

/** Who must act now (ignores pause), or null when the game is over. */
export function turnOf(s: GameState): PlayerId | null {
  const r = s.round;
  if (!r) return null;
  switch (s.phase) {
    case 'bidding':
      return r.bid.turn;
    case 'decision':
    case 'handout':
      return r.bid.high;
    case 'talon':
      return null; // everyone but the bidder acts at once; see actorsOf
    case 'tricks': {
      const cards = r.trick.cards;
      return cards.length === 0 ? r.trick.leader : nextActive(r.active, cards[cards.length - 1].p);
    }
    default:
      return null;
  }
}

/** Seats (in seat order) that still have to confirm a public talon; [] outside the talon phase. */
export function talonWaiting(s: GameState): PlayerId[] {
  const r = s.round;
  if (!r || s.phase !== 'talon') return [];
  const seen = r.talonSeen ?? []; // states saved before M5 have no talonSeen; they are never in 'talon'
  return s.seats.map(x => x.id).filter(id => id !== r.bid.high && !seen.includes(id));
}

/** Everyone who has a move to make now (ignores pause). One player except during the talon phase. */
export function actorsOf(s: GameState): PlayerId[] {
  if (s.phase === 'talon') return talonWaiting(s);
  const t = turnOf(s);
  return t ? [t] : [];
}

export function legalActions(s: GameState, p: PlayerId): Action[] {
  const r = s.round;
  if (!r || s.phase === 'gameEnd' || !s.seats.some(x => x.id === p)) return [];
  if (s.paused) return [{ type: 'resume' }];
  const out: Action[] =
    s.phase === 'talon' ? (talonWaiting(s).includes(p) ? [{ type: 'ackTalon' }] : []) : turnOf(s) === p ? phaseActions(s, r, p) : [];
  out.push({ type: 'pause' });
  return out;
}

function phaseActions(s: GameState, r: Round, p: PlayerId): Action[] {
  switch (s.phase) {
    case 'bidding': {
      const next = r.bid.amount + RULES.bidStep;
      const acts: Action[] = [];
      if (next <= maxBidFor(r.hands[p])) acts.push({ type: 'bid', amount: next });
      acts.push({ type: 'pass' });
      return acts;
    }
    case 'decision':
      return [{ type: 'play' }, { type: 'throw' }];
    case 'handout':
      return handoutOptions(r.hands[p], r.active.filter(q => q !== p));
    case 'tricks':
      return getValidCards(r.hands[p], r.trick.cards, r.trump).map(card => ({ type: 'card', card: { ...card } }));
    default:
      return [];
  }
}

/** Every way to give one distinct card to each of the two recipients. */
export function handoutOptions(hand: Card[], recipients: PlayerId[]): Action[] {
  const [x, y] = recipients;
  const out: Action[] = [];
  for (const c1 of hand) {
    for (const c2 of hand) {
      if (cardEquals(c1, c2)) continue;
      out.push({ type: 'handout', to: { [x]: { ...c1 }, [y]: { ...c2 } } });
    }
  }
  return out;
}

/** Structural equality of a known-good action `a` with untrusted input `b`. */
export function actionsEqual(a: Action, b: unknown): boolean {
  if (!b || typeof b !== 'object') return false;
  const o = b as Record<string, unknown>;
  if (o.type !== a.type) return false;
  switch (a.type) {
    case 'bid':
      return o.amount === a.amount;
    case 'card':
      return isCard(o.card) && cardEquals(a.card, o.card);
    case 'handout': {
      const to = o.to;
      if (!to || typeof to !== 'object') return false;
      const given = to as Record<string, unknown>;
      const keys = Object.keys(a.to);
      return (
        Object.keys(given).length === keys.length &&
        keys.every(k => {
          const x = given[k];
          return isCard(x) && cardEquals(a.to[k], x);
        })
      );
    }
    default:
      return true;
  }
}

import type { Card, GameEvent, GameState, PlayerId, PlayerView, Round, RoundView } from './types';
import { legalActions, talonWaiting, turnOf } from './actions';
import { clone } from './ctx';
import { handPoints } from './cards';
import { maxBidFor } from './bidding';
import { cardRuleMessage } from './tricks';
import { msg, type EngineMsg } from './messages';

/** Everything `me` is allowed to know. This is the only state that may leave the server. */
export function viewFor(s: GameState, me: PlayerId): PlayerView {
  return {
    v: 1,
    seq: s.seq,
    me,
    seats: clone(s.seats),
    maxPlayers: s.maxPlayers,
    firstDealer: s.firstDealer,
    phase: s.phase,
    paused: s.paused ? { ...s.paused } : null,
    winner: s.winner,
    scores: clone(s.scores),
    rounds: clone(s.rounds),
    turn: turnOf(s),
    legal: s.seats.some(x => x.id === me) ? legalActions(s, me) : [],
    round: s.round ? roundView(s, s.round, me) : null,
  };
}

function roundView(s: GameState, r: Round, me: PlayerId): RoundView {
  const bidder = r.bid.high;
  const talonVisible = s.phase !== 'bidding' && (r.talonPublic || me === bidder);
  const myHand = Object.hasOwn(r.hands, me) ? r.hands[me] : undefined;
  let handout: Partial<Record<PlayerId, Card>> | null = null;
  if (r.handoutGiven) {
    if (me === bidder) handout = clone(r.handoutGiven);
    else {
      const mine = Object.hasOwn(r.handoutGiven, me) ? r.handoutGiven[me] : undefined;
      handout = mine ? { [me]: { ...mine } } : {};
    }
  }
  const per = <T>(f: (p: PlayerId) => T): Record<PlayerId, T> => Object.fromEntries(r.active.map(p => [p, f(p)]));
  return {
    number: r.number,
    dealer: r.dealer,
    active: [...r.active],
    sittingOut: s.seats.length === 4 ? r.dealer : null,
    hand: myHand ? clone(myHand) : [],
    handCounts: per(p => r.hands[p].length),
    talon: talonVisible ? clone(r.talon) : null,
    talonPublic: r.talonPublic,
    talonWaiting: talonWaiting(s),
    bid: clone(r.bid),
    maxBid: myHand ? maxBidFor(myHand) : 0,
    trump: r.trump,
    marriages: clone(r.marriages),
    trick: clone(r.trick),
    lastTrick: r.lastTrick ? clone(r.lastTrick) : null,
    played: r.active.flatMap(p => r.tricksWon[p].flat()).map(card => ({ ...card })),
    tricksTaken: per(p => r.tricksWon[p].length),
    trickPoints: per(p => r.tricksWon[p].reduce((sum, t) => sum + handPoints(t), 0)),
    handout,
  };
}

/** The events `p` may receive. */
export function eventsFor(events: GameEvent[], p: PlayerId): GameEvent[] {
  return events.filter(e => e.audience === 'all' || e.audience.includes(p));
}

/** Why `card` can't be played by the viewer right now, or null if it can. */
export function explainIllegal(view: PlayerView, card: Card): EngineMsg | null {
  const r = view.round;
  if (view.paused) return msg('illegal.paused');
  if (!r || view.phase !== 'tricks' || view.turn === null) return msg('illegal.notNow');
  if (view.turn !== view.me) return msg('illegal.waitFor', { player: { player: view.turn } });
  return cardRuleMessage(r.hand, r.trick.cards, r.trump, card);
}

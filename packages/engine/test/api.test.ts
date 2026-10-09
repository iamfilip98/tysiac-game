import { describe, it, expect } from 'vitest';
import * as engine from '../src/index';
import type {
  Action, Advice, Card, GameEvent, GameState, PlayerId, PlayerView, Rank, RuleError, Seat, Suit,
} from '../src/index';

describe('public API', () => {
  it('exports the engine functions later milestones use', () => {
    for (const name of [
      'createGame', 'reduce', 'legalActions', 'turnOf', 'viewFor', 'eventsFor', 'explainIllegal',
      'botAction', 'advise', 'explainEvent', 'detectWykladana', 'scoreRound', 'roundToTen', 'isOnBarrel',
      'makeRandom', 'cardLabel', 'parseCard', 'actionsEqual',
    ] as const) {
      expect(typeof engine[name]).toBe('function');
    }
    expect(engine.RULES.winAt).toBe(1000);
    expect(engine.SUIT_SYMBOL.hearts).toBe('♥');
  });

  it('types line up end to end', () => {
    const seats: Seat[] = [
      { id: 'x', name: 'X', avatar: '🙂', isBot: true },
      { id: 'y', name: 'Y', avatar: '🙂', isBot: true },
      { id: 'z', name: 'Z', avatar: '🙂', isBot: true },
    ];
    const state: GameState = engine.createGame({ seed: 'api', seats, maxPlayers: 3, firstDealer: 0 });
    const me: PlayerId = engine.turnOf(state)!;
    const view: PlayerView = engine.viewFor(state, me);
    const action: Action = engine.botAction(view, engine.makeRandom('api'));
    const advice: Advice | null = engine.advise(view);
    const res = engine.reduce(state, me, action, 0);
    const events: GameEvent[] = res.ok ? engine.eventsFor(res.events, me) : [];
    const error: RuleError | null = res.ok ? null : res.error;
    const card: Card = view.round!.hand[0];
    const suit: Suit = card.suit;
    const rank: Rank = card.rank;
    expect(advice).not.toBeNull();
    expect(error).toBeNull();
    expect(events.map(e => e.type)).toContain(action.type === 'pass' ? 'passed' : 'bid');
    expect(engine.RULES.suits).toContain(suit);
    expect(engine.RULES.ranks).toContain(rank);
  });
});

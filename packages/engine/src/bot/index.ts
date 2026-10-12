import type { Action, PlayerView } from '../types';
import { actionsEqual } from '../actions';
import { isOnBarrel } from '../scoring';
import { decideBid, decideHandout, decidePlayOrThrow } from './eval';
import { decideCard, marriageToDeclare } from './play';

/**
 * True exactly when `botAction(view, ...)` is safe to call: it is this player's turn, the game is not
 * paused, the phase isn't `gameEnd`, and `view.legal` has a non-pause action.
 */
export function botShouldAct(view: PlayerView): boolean {
  if (view.phase === 'gameEnd' || view.paused) return false;
  return view.legal.some(a => a.type !== 'pause' && a.type !== 'resume');
}

/**
 * Bot move from the bot's own view only. `rng` is used only as a fallback tie-breaker.
 * @throws Error when the viewer has nothing to do (not its turn, game paused, or `gameEnd`).
 *   Guard calls with `botShouldAct(view)`.
 */
export function botAction(view: PlayerView, rng: () => number): Action {
  const options = view.legal.filter(a => a.type !== 'pause' && a.type !== 'resume');
  if (options.length === 0) throw new Error(`botAction: ${view.me} has nothing to do`);
  const chosen = decide(view, options);
  if (chosen && options.some(a => actionsEqual(a, chosen))) return chosen;
  return options[Math.floor(rng() * options.length)];
}

function decide(view: PlayerView, options: Action[]): Action | null {
  const r = view.round;
  if (!r) return null;
  const hand = r.hand;
  switch (view.phase) {
    case 'bidding': {
      const d = decideBid(hand, r.bid.amount, r.bid.passed.length);
      return d.shouldBid ? { type: 'bid', amount: d.amount } : { type: 'pass' };
    }
    case 'talon':
      return { type: 'ackTalon' };
    case 'decision': {
      const onBarrel = isOnBarrel(view.scores[view.me]?.total ?? 0);
      return decidePlayOrThrow(hand, r.bid.amount, onBarrel) === 'play' ? { type: 'play' } : { type: 'throw' };
    }
    case 'handout': {
      const recipients = r.active.filter(p => p !== view.me);
      const totals = Object.fromEntries(recipients.map(p => [p, view.scores[p]?.total ?? 0]));
      return { type: 'handout', to: decideHandout(hand, recipients, totals) };
    }
    case 'tricks': {
      if (r.trick.cards.length === 0) {
        const suit = marriageToDeclare(hand, r.marriages[view.me] ?? []);
        if (suit) return { type: 'card', card: { suit, rank: 'Q' } };
      }
      const valid = options.flatMap(a => (a.type === 'card' ? [a.card] : []));
      return {
        type: 'card',
        card: decideCard({
          valid,
          trick: r.trick.cards,
          trump: r.trump,
          isBidder: view.me === r.bid.high,
          bidder: r.bid.high,
          hand,
          played: r.played,
          declared: r.marriages[view.me] ?? [],
        }),
      };
    }
    default:
      return null;
  }
}

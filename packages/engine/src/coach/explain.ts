import type { GameEvent, PlayerView, RoundSummary } from '../types';
import { SUIT_SYMBOL } from '../rules';
import { cardLabel } from '../cards';
import { roundToTen } from '../scoring';
import { nameOf } from './names';

/** One short sentence explaining an event to `view.me`, or null if it needs no explanation. */
export function explainEvent(event: GameEvent, view: PlayerView): string | null {
  switch (event.type) {
    case 'marriage': {
      const s = SUIT_SYMBOL[event.suit];
      return `${nameOf(view, event.p)} declared the ${s} marriage: +${event.points}. ${s} are trumps now.`;
    }
    case 'trickWon':
      return event.byTrump
        ? `${nameOf(view, event.p)} won with ${cardLabel(event.card)} — trumps beat every other suit.`
        : null;
    case 'biddingWon': {
      const who = nameOf(view, event.p);
      if (event.talonPublic) return `${who} won the bid at ${event.amount}. Over 100, so everyone sees the talon.`;
      const sees = event.p === view.me ? 'you see' : `${who} sees`;
      return `${who} won the bid at ${event.amount}. At 100 only ${sees} the talon.`;
    }
    case 'threw':
      return explainThrow(event.summary, event.amount, view);
    case 'wykladana': {
      const verb = event.p === view.me ? 'have' : 'has';
      return `${nameOf(view, event.p)} ${verb} every trick guaranteed — round won outright (wykładana)!`;
    }
    case 'roundScored':
      return explainRound(event.summary, view);
    case 'gameWon':
      return `${nameOf(view, event.p)} won the game with ${event.totals[event.p]}!`;
    default:
      return null;
  }
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0';
}

/** Throw-in text built from the real score changes (barrel players and a sitting-out dealer get 0). */
function explainThrow(summary: RoundSummary, amount: number, view: PlayerView): string {
  const who = nameOf(view, summary.bidder);
  if (summary.players.every(p => p.scoreChange === 0)) return `${who} threw in at ${amount} — nobody scores, new deal.`;
  const changes = summary.players.map(p => `${nameOf(view, p.playerId)} ${signed(p.scoreChange)}`);
  return `${who} threw in at ${amount}: ${changes.join(', ')}.`;
}

function explainRound(summary: RoundSummary, view: PlayerView): string {
  if (summary.outcome === 'thrown') return explainThrow(summary, summary.bid, view);
  const bidder = summary.players.find(p => p.playerId === summary.bidder)!;
  const name = nameOf(view, summary.bidder);
  const parts: string[] = [];
  if (summary.outcome === 'made') {
    const rounded = roundToTen(bidder.totalRoundPoints) !== bidder.totalRoundPoints ? ' (rounded)' : '';
    parts.push(`${name} bid ${summary.bid} and scored ${bidder.totalRoundPoints} → +${bidder.scoreChange}${rounded}`);
  } else {
    // A near miss that would round up to the bid still fails: rounding never helps the bidder.
    const near = roundToTen(bidder.totalRoundPoints) >= summary.bid
      ? " — rounding doesn't help a bidder who falls short"
      : '';
    parts.push(`${name} bid ${summary.bid} but scored only ${bidder.totalRoundPoints} → −${summary.bid}${near}`);
  }
  if (bidder.fellOffBarrel) parts.push(`${name} fell off the barrel`);
  const mine = summary.players.find(p => p.playerId === view.me);
  if (mine && mine.playerId !== summary.bidder) {
    if (mine.wasOnBarrel) parts.push("You're on the barrel — only winning a bid scores there");
    else if (mine.sittingOut) parts.push(`You sat out: +${mine.scoreChange} from the talon`);
    else parts.push(`You: +${mine.scoreChange}`);
  }
  return `${parts.join('. ')}.`;
}

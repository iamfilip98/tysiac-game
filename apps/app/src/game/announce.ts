import { cardLabel, type Card, type GameEvent, type PlayerId, type PlayerView, type Suit } from '@tysiac/engine';
import { who } from '../store/notes';
import { SUIT_TEXT, textSuits } from './cards';

export type Announcement =
  | { kind: 'deal'; round: number; dealer: PlayerId }
  | { kind: 'bid'; p: PlayerId; amount: number }
  | { kind: 'pass'; p: PlayerId }
  | { kind: 'bidWon'; p: PlayerId; amount: number }
  | { kind: 'threw'; p: PlayerId; amount: number }
  | { kind: 'talonSeen'; p: PlayerId }
  | { kind: 'handout'; p: PlayerId }
  | { kind: 'received'; from: PlayerId; card: Card }
  | { kind: 'wykladana'; p: PlayerId }
  | { kind: 'played'; p: PlayerId; card: Card }
  | { kind: 'marriage'; p: PlayerId; suit: Suit; points: number }
  | { kind: 'trick'; p: PlayerId; points: number }
  | { kind: 'won'; p: PlayerId }
  | { kind: 'paused'; p: PlayerId }
  | { kind: 'resumed'; p: PlayerId };

export function announcementFor(e: GameEvent, me: PlayerId | null): Announcement | null {
  switch (e.type) {
    case 'dealt': return { kind: 'deal', round: e.round, dealer: e.dealer };
    case 'bid': return { kind: 'bid', p: e.p, amount: e.amount };
    case 'passed': return { kind: 'pass', p: e.p };
    case 'biddingWon': return { kind: 'bidWon', p: e.p, amount: e.amount };
    case 'threw': return { kind: 'threw', p: e.p, amount: e.amount };
    case 'talonSeen': return { kind: 'talonSeen', p: e.p };
    case 'handedOut': {
      const mine = me !== null && e.p !== me ? e.cards[me] : undefined;
      return mine ? { kind: 'received', from: e.p, card: mine } : { kind: 'handout', p: e.p };
    }
    case 'wykladana': return { kind: 'wykladana', p: e.p };
    case 'cardPlayed': return e.p === me ? null : { kind: 'played', p: e.p, card: e.card };
    case 'marriage': return { kind: 'marriage', p: e.p, suit: e.suit, points: e.points };
    case 'trickWon': return { kind: 'trick', p: e.p, points: e.points };
    case 'gameWon': return { kind: 'won', p: e.p };
    case 'paused': return { kind: 'paused', p: e.p };
    case 'resumed': return { kind: 'resumed', p: e.p };
    default: return null;
  }
}

const isMe = (v: PlayerView, p: PlayerId) => p === v.me;

/** English text. Stream P replaces every literal here with t(...). */
export function announceText(a: Announcement, v: PlayerView): string {
  return textSuits(announceRaw(a, v));
}

function announceRaw(a: Announcement, v: PlayerView): string {
  switch (a.kind) {
    case 'deal': return `Round ${a.round} — ${isMe(v, a.dealer) ? 'you deal' : `${who(v, a.dealer)} deals`}`;
    case 'bid': return `${who(v, a.p)} bid ${a.amount}`;
    case 'pass': return `${who(v, a.p)} passed`;
    case 'bidWon': return `${who(v, a.p)} won the bid at ${a.amount}`;
    case 'threw': return `${who(v, a.p)} threw in at ${a.amount}`;
    case 'talonSeen': return isMe(v, a.p) ? 'You have seen the talon' : `${who(v, a.p)} has seen the talon`;
    case 'handout': return isMe(v, a.p) ? 'You handed out 2 cards' : `${who(v, a.p)} handed out cards`;
    case 'received': return `You got ${cardLabel(a.card)} from ${who(v, a.from)}`;
    case 'wykladana': return `${who(v, a.p)} won every trick — wykładana!`;
    case 'played': return `${who(v, a.p)} played ${cardLabel(a.card)}`;
    case 'marriage': {
      const s = SUIT_TEXT[a.suit];
      return `${who(v, a.p)}: marriage ${s} +${a.points} — trump is ${s}`;
    }
    case 'trick': return `${who(v, a.p)} ${isMe(v, a.p) ? 'take' : 'takes'} the trick (+${a.points})`;
    case 'won': return `${who(v, a.p)} ${isMe(v, a.p) ? 'win' : 'wins'} the game!`;
    case 'paused': return `${who(v, a.p)} paused the game`;
    case 'resumed': return `${who(v, a.p)} resumed the game`;
  }
}

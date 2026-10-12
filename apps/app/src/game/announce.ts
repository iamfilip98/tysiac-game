import { type Card, type GameEvent, type PlayerId, type PlayerView, type Suit } from '@tysiac/engine';
import { who } from '../store/notes';
import { SUIT_TEXT, textSuits } from './cards';
import { t } from '../i18n';
import { cardText } from '../i18n/engineText';

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

/** The ticker line in the active language. Sentences about the viewer use their own `.you` keys. */
export function announceText(a: Announcement, v: PlayerView): string {
  return textSuits(announceRaw(a, v));
}

function announceRaw(a: Announcement, v: PlayerView): string {
  const player = 'p' in a ? who(v, a.p) : '';
  const me = 'p' in a && isMe(v, a.p);
  switch (a.kind) {
    case 'deal': return isMe(v, a.dealer) ? t('game.ann.deal.you', { round: a.round }) : t('game.ann.deal', { round: a.round, player: who(v, a.dealer) });
    case 'bid': return t(me ? 'game.ann.bid.you' : 'game.ann.bid', { player, amount: a.amount });
    case 'pass': return t(me ? 'game.ann.pass.you' : 'game.ann.pass', { player });
    case 'bidWon': return t(me ? 'game.ann.bidWon.you' : 'game.ann.bidWon', { player, amount: a.amount });
    case 'threw': return t(me ? 'game.ann.threw.you' : 'game.ann.threw', { player, amount: a.amount });
    case 'talonSeen': return t(me ? 'game.ann.talonSeen.you' : 'game.ann.talonSeen', { player });
    case 'handout': return t(me ? 'game.ann.handout.you' : 'game.ann.handout', { player });
    case 'received': return t('game.ann.received', { card: cardText(a.card), player: who(v, a.from) });
    case 'wykladana': return t(me ? 'game.ann.wykladana.you' : 'game.ann.wykladana', { player });
    case 'played': return t('game.ann.played', { player, card: cardText(a.card) });
    case 'marriage': return t(me ? 'game.ann.marriage.you' : 'game.ann.marriage', { player, suit: SUIT_TEXT[a.suit], points: a.points });
    case 'trick': return t(me ? 'game.ann.trick.you' : 'game.ann.trick', { player, points: a.points });
    case 'won': return t(me ? 'game.ann.won.you' : 'game.ann.won', { player });
    case 'paused': return t(me ? 'game.ann.paused.you' : 'game.ann.paused', { player });
    case 'resumed': return t(me ? 'game.ann.resumed.you' : 'game.ann.resumed', { player });
  }
}

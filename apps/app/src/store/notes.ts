import { SUIT_SYMBOL, explainEvent, type GameEvent, type PlayerId, type PlayerView } from '@tysiac/engine';

/** 'You' for the viewer, otherwise the seat's name. */
export function who(view: PlayerView, p: PlayerId): string {
  if (p === view.me) return 'You';
  return view.seats.find(s => s.id === p)?.name ?? 'Someone';
}

/** A one-line note shown in the action zone while an event plays. */
export function eventNote(e: GameEvent, view: PlayerView, coach: boolean): string | null {
  if (coach) {
    const text = explainEvent(e, view);
    if (text) return text;
  }
  switch (e.type) {
    case 'marriage': {
      const s = SUIT_SYMBOL[e.suit];
      return `${who(view, e.p)} declared the ${s} marriage: +${e.points}. ${s} are trumps.`;
    }
    case 'wykladana':
      return `${who(view, e.p)} won every trick — wykładana!`;
    case 'biddingWon':
      return `${who(view, e.p)} won the bid at ${e.amount}.`;
    default:
      return null;
  }
}

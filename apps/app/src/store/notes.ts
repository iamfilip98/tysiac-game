import { explainEvent, type GameEvent, type PlayerId, type PlayerView } from '@tysiac/engine';

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
  // Marriage, wykladana and bidding-won are covered by the ticker (game/announce.ts).
  return null;
}

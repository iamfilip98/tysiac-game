import type { PlayerId, PlayerView } from '../types';

export function nameOf(view: PlayerView, p: PlayerId): string {
  if (p === view.me) return 'You';
  return view.seats.find(s => s.id === p)?.name ?? 'Someone';
}

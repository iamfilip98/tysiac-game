import type { PlayerId, PlayerView } from '@tysiac/engine';

export interface PlayerStats {
  id: PlayerId;
  name: string;
  avatar: string;
  total: number;
  bidsMade: number;
  bidsFailed: number;
  marriagePoints: number;
  bestRound: number;
}

export function gameStats(view: PlayerView): PlayerStats[] {
  return view.seats
    .map(s => {
      const mine = view.rounds.flatMap(r => r.players.filter(p => p.playerId === s.id));
      return {
        id: s.id,
        name: s.name,
        avatar: s.avatar,
        total: view.scores[s.id]?.total ?? 0,
        bidsMade: view.rounds.filter(r => r.bidder === s.id && r.outcome === 'made').length,
        bidsFailed: view.rounds.filter(r => r.bidder === s.id && r.outcome === 'failed').length,
        marriagePoints: mine.reduce((n, p) => n + (p.sittingOut ? 0 : p.marriagePoints), 0),
        bestRound: mine.reduce((best, p) => Math.max(best, p.scoreChange), 0),
      };
    })
    .sort((a, b) => b.total - a.total);
}

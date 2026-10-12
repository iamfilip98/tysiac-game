import { RULES, type PlayerId, type PlayerView, type RoundOutcome } from '@tysiac/engine';
import { Sheet } from '../ui/Sheet';
import { useT } from '../i18n/useT';

export interface ZapisCell {
  id: PlayerId;
  total: number;
  change: number;
  bid: string | null;
  failed: boolean;
  barrel: boolean;
  sittingOut: boolean;
}
export interface ZapisRow {
  number: number;
  outcome: RoundOutcome;
  cells: ZapisCell[];
}

/** Round-by-round running totals, like the paper score sheet (zapis). */
export function zapisRows(view: PlayerView): ZapisRow[] {
  return view.rounds.map(r => ({
    number: r.number,
    outcome: r.outcome,
    cells: view.seats.map(s => {
      const p = r.players.find(x => x.playerId === s.id);
      const total = p?.newTotalScore ?? 0;
      return {
        id: s.id,
        total,
        change: p?.scoreChange ?? 0,
        bid: r.bidder === s.id ? (r.outcome === 'thrown' ? `${r.bid}✕` : String(r.bid)) : null,
        failed: r.bidder === s.id && r.outcome === 'failed',
        barrel: total >= RULES.barrelAt && total < RULES.winAt,
        sittingOut: p?.sittingOut ?? false,
      };
    }),
  }));
}

export function ScoreSheet({ view, onClose }: { view: PlayerView; onClose(): void }) {
  const t = useT();
  const rows = zapisRows(view);
  return (
    <Sheet title={t('game.score.title')} onClose={onClose}>
      <table className="zapis">
        <thead>
          <tr>
            <th>#</th>
            {view.seats.map(s => (
              <th key={s.id}>
                {s.avatar} {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.number}>
              <td>{row.number}</td>
              {row.cells.map(c => (
                <td key={c.id} className={`${c.failed ? 'zapis__failed' : ''} ${c.barrel ? 'zapis__barrel' : ''}`}>
                  {c.total}
                  {c.bid && <small>{t('game.score.bid', { bid: c.bid })}</small>}
                  {c.sittingOut && <small>{t('game.score.dealt')}</small>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p>{t('game.score.none')}</p>}
    </Sheet>
  );
}

import { SUIT_SYMBOL, type PlayerView } from '@tysiac/engine';
import { who } from '../store/notes';
import { pts } from './format';

export function TopBar({ view, onMenu, onScores }: { view: PlayerView; onMenu(): void; onScores(): void }) {
  const r = view.round;
  const mine = view.scores[view.me]?.total ?? 0;
  let sub = '';
  if (r && view.phase === 'bidding') {
    sub = `${who(view, r.dealer)} ${r.dealer === view.me ? 'deal' : 'deals'} · bidding`;
  } else if (r) {
    sub = `${who(view, r.bid.high)} bid ${r.bid.amount}${r.trump ? ` · trump ${SUIT_SYMBOL[r.trump]}` : ''}`;
  }
  return (
    <header className="topbar">
      <button type="button" className="iconbtn" aria-label="Menu" onClick={onMenu}>
        ☰
      </button>
      <div className="topbar__info">
        <b className="display">{r ? `Round ${r.number}` : 'Tysiąc'}</b>
        <span>{sub}</span>
      </div>
      <button type="button" className="iconbtn topbar__score" aria-label={`Score sheet, you have ${pts(mine)}`} onClick={onScores}>
        <span className="topbar__scorelbl">Score</span>
        <b className="topbar__scoreval display">{mine}</b>
      </button>
    </header>
  );
}

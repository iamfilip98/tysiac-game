import type { PlayerView } from '@tysiac/engine';
import { who } from '../store/notes';
import { pts } from './format';
import { SUIT_TEXT } from './cards';
import { useT } from '../i18n/useT';

export function TopBar({ view, onMenu, onScores }: { view: PlayerView; onMenu(): void; onScores(): void }) {
  const t = useT();
  const r = view.round;
  const mine = view.scores[view.me]?.total ?? 0;
  let sub = '';
  if (r && view.phase === 'bidding') {
    sub = t(r.dealer === view.me ? 'game.top.deals.you' : 'game.top.deals', { player: who(view, r.dealer) });
  } else if (r) {
    const you = r.bid.high === view.me;
    const p = { player: who(view, r.bid.high), amount: r.bid.amount };
    sub = r.trump
      ? t(you ? 'game.top.bidTrump.you' : 'game.top.bidTrump', { ...p, suit: SUIT_TEXT[r.trump] })
      : t(you ? 'game.top.bid.you' : 'game.top.bid', p);
  }
  return (
    <header className="topbar">
      <button type="button" className="iconbtn" aria-label={t('game.top.menu')} onClick={onMenu}>
        ☰
      </button>
      <div className="topbar__info">
        <b className="display">{r ? t('game.top.round', { n: r.number }) : 'Tysiąc'}</b>
        <span>{sub}</span>
      </div>
      <button type="button" className="iconbtn topbar__score" aria-label={t('game.top.scoreAria', { points: pts(mine) })} onClick={onScores}>
        <span className="topbar__scorelbl">{t('game.top.score')}</span>
        <b className="topbar__scoreval display">{mine}</b>
      </button>
    </header>
  );
}

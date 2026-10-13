import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { fetchHistory } from '../net/history';
import { RoomApiError } from '../net/httpService';
import { getIdentity } from '../net/identity';
import { isLocalMode } from '../net/service';
import type { HistoryGame, HistoryResponse } from '../net/protocol';
import { currentLang, t as tr } from '../i18n';
import { useT } from '../i18n/useT';
import { Segmented } from '../ui/controls';
import './history.css';

type Tab = 'recent' | 'rivals' | 'board';
type Load = { kind: 'loading' } | { kind: 'error'; error: unknown } | { kind: 'ok'; data: HistoryResponse };
const TABS = [
  { id: 'recent', label: 'screens.history.recent' },
  { id: 'rivals', label: 'screens.history.rivals' },
  { id: 'board', label: 'screens.history.board' },
] as const satisfies readonly { id: Tab; label: string }[];
/** Dates in the app's language (not the phone's), so an English UI never shows Polish month names. */
const when = (at: number) =>
  new Intl.DateTimeFormat(currentLang(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(at);

function GameRow({ g, me }: { g: HistoryGame; me: string }) {
  const t = useT();
  const players = [...g.players].sort((a, b) => b.finalScore - a.finalScore);
  const winner = g.players.find(p => p.id === g.winnerId);
  const bots = g.players.some(p => p.isBot);
  return (
    <li className="hrow panel">
      <div className="hrow__head">
        <span>{when(g.finishedAt)}</span>
        <span className="hrow__muted">
          {t('screens.history.players', { n: g.playerCount })}
          {bots ? ` · ${t('screens.history.withBots')}` : ''}
        </span>
      </div>
      <b className="hrow__result">{g.winnerId === me ? t('screens.history.youWon') : t('screens.history.won', { name: winner?.name ?? t('common.someone') })}</b>
      <ul className="hrow__players">
        {players.map(p => (
          <li key={p.id}>
            <span className="hrow__name">
              {p.won ? '👑 ' : ''}
              {p.avatar} {p.name}
              {p.id === me ? ` ${t('screens.history.you')}` : ''}
            </span>
            <span className="hrow__score">{p.finalScore}</span>
          </li>
        ))}
      </ul>
    </li>
  );
}

/** A failed history load, in the active language. */
function apiErrorText(e: unknown): string {
  if (!(e instanceof RoomApiError)) return tr('errors.generic');
  if (e.kind === 'network') return tr('errors.unreachable');
  if (e.kind === 'badResponse') return tr('errors.badResponse');
  return e.status ? tr('errors.serverStatus', { status: e.status }) : tr('errors.generic');
}

export default function History() {
  const t = useT();
  const [, navigate] = useLocation();
  const local = isLocalMode();
  const me = getIdentity().playerId;
  const [tab, setTab] = useState<Tab>('recent');
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (local) return;
    let alive = true;
    setLoad({ kind: 'loading' });
    fetchHistory(me).then(
      data => {
        if (!alive) return;
        setLoad({ kind: 'ok', data });
        // The Retry button unmounts on success; park focus on the heading so keyboard/VoiceOver users aren't lost.
        if (attempt > 0) heading.current?.focus();
      },
      (e: unknown) => alive && setLoad({ kind: 'error', error: e }),
    );
    return () => {
      alive = false;
    };
  }, [local, me, attempt]);

  let body: ReactNode;
  if (local) body = <p className="history__note">{t('screens.history.local')}</p>;
  else if (load.kind === 'loading') body = <p className="history__note">{t('common.loading')}</p>;
  else if (load.kind === 'error') {
    body = (
      <div className="history__note">
        <p>{apiErrorText(load.error)}</p>
        <button type="button" className="btn btn--sec" onClick={() => setAttempt(a => a + 1)}>
          {t('common.retry')}
        </button>
      </div>
    );
  } else {
    const d = load.data;
    if (tab === 'recent') {
      body = d.games.length ? (
        <ul className="history__list" data-scroll-clip>
          {d.games.map(g => <GameRow key={g.id} g={g} me={me} />)}
        </ul>
      ) : (
        <p className="history__note">{t('screens.history.noGames')}</p>
      );
    } else if (tab === 'rivals') {
      body = d.headToHead.length ? (
        <ul className="history__list" data-scroll-clip>
          {d.headToHead.map(h => (
            <li key={h.opponentId} className="hrow panel hrow--line">
              <span className="hrow__name">
                {h.avatar} {h.name}
              </span>
              <span className="hrow__score">{t('screens.history.h2h', { wins: h.wins, losses: h.losses, games: h.games })}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="history__note">{t('screens.history.noRivals')}</p>
      );
    } else {
      body = (
        <>
          <p className="history__note history__note--small">{t('screens.history.botsNote')}</p>
          {d.leaderboard.length ? (
            <ol className="history__list" data-scroll-clip>
              {d.leaderboard.map((r, i) => (
                <li key={r.playerId} className={`hrow panel hrow--line${r.playerId === me ? ' hrow--me' : ''}`}>
                  <span className="hrow__name">
                    {i + 1}. {r.avatar} {r.name}
                  </span>
                  <span className="hrow__score">
                    {t('screens.history.boardRow', { games: r.games, wins: r.wins, pct: r.games ? Math.round((r.wins * 100) / r.games) : 0 })}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="history__note">{t('screens.history.noBoard')}</p>
          )}
        </>
      );
    }
  }

  return (
    <main className="history">
      <header className="history__top">
        <button type="button" className="btn btn--sec" onClick={() => navigate('/')}>
          {t('common.home')}
        </button>
        <h1 className="display" ref={heading} tabIndex={-1}>
          {t('screens.history.title')}
        </h1>
      </header>
      <Segmented<Tab> label={t('screens.history.show')} value={tab} options={TABS.map(tb => ({ value: tb.id, label: t(tb.label) }))} onChange={setTab} />
      <section className="history__body" aria-live={!local && load.kind !== 'ok' ? 'polite' : 'off'}>{body}</section>
    </main>
  );
}

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { fetchHistory } from '../net/history';
import { RoomApiError } from '../net/httpService';
import { getIdentity } from '../net/identity';
import { isLocalMode } from '../net/service';
import type { HistoryGame, HistoryResponse } from '../net/protocol';
import './history.css';

type Tab = 'recent' | 'rivals' | 'board';
type Load = { kind: 'loading' } | { kind: 'error'; text: string } | { kind: 'ok'; data: HistoryResponse };
const TABS: { id: Tab; label: string }[] = [
  { id: 'recent', label: 'Recent games' },
  { id: 'rivals', label: 'Head-to-head' },
  { id: 'board', label: 'Leaderboard' },
];
const when = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function GameRow({ g, me }: { g: HistoryGame; me: string }) {
  const players = [...g.players].sort((a, b) => b.finalScore - a.finalScore);
  const winner = g.players.find(p => p.id === g.winnerId);
  const bots = g.players.some(p => p.isBot);
  return (
    <li className="hrow panel">
      <div className="hrow__head">
        <span>{when.format(g.finishedAt)}</span>
        <span className="hrow__muted">
          {g.playerCount} players{bots ? ' · with bots' : ''}
        </span>
      </div>
      <b className="hrow__result">{g.winnerId === me ? 'You won' : `${winner?.name ?? 'Someone'} won`}</b>
      <ul className="hrow__players">
        {players.map(p => (
          <li key={p.id}>
            <span className="hrow__name">
              {p.won ? '👑 ' : ''}
              {p.avatar} {p.name}
              {p.id === me ? ' (you)' : ''}
            </span>
            <span className="hrow__score">{p.finalScore}</span>
          </li>
        ))}
      </ul>
    </li>
  );
}

export default function History() {
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
      (e: unknown) => alive && setLoad({ kind: 'error', text: e instanceof RoomApiError ? e.message : 'Something went wrong.' }),
    );
    return () => {
      alive = false;
    };
  }, [local, me, attempt]);

  let body: ReactNode;
  if (local) body = <p className="history__note">History is kept for online games only — practice in this tab is not recorded.</p>;
  else if (load.kind === 'loading') body = <p className="history__note">Loading…</p>;
  else if (load.kind === 'error') {
    body = (
      <div className="history__note">
        <p>{load.text}</p>
        <button type="button" className="btn btn--sec" onClick={() => setAttempt(a => a + 1)}>
          Retry
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
        <p className="history__note">No finished games yet — play one with friends!</p>
      );
    } else if (tab === 'rivals') {
      body = d.headToHead.length ? (
        <ul className="history__list" data-scroll-clip>
          {d.headToHead.map(h => (
            <li key={h.opponentId} className="hrow panel hrow--line">
              <span className="hrow__name">
                {h.avatar} {h.name}
              </span>
              <span className="hrow__score">{`${h.wins} W · ${h.losses} L · ${h.games} games`}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="history__note">No games against friends yet.</p>
      );
    } else {
      body = (
        <>
          <p className="history__note history__note--small">Games with bots don't count here.</p>
          {d.leaderboard.length ? (
            <ol className="history__list" data-scroll-clip>
              {d.leaderboard.map((r, i) => (
                <li key={r.playerId} className={`hrow panel hrow--line${r.playerId === me ? ' hrow--me' : ''}`}>
                  <span className="hrow__name">
                    {i + 1}. {r.avatar} {r.name}
                  </span>
                  <span className="hrow__score">{`${r.games} games · ${r.wins} wins · ${r.games ? Math.round((r.wins * 100) / r.games) : 0}%`}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="history__note">Play a game with friends (no bots) to get on the board.</p>
          )}
        </>
      );
    }
  }

  return (
    <main className="history">
      <header className="history__top">
        <button type="button" className="btn btn--sec" onClick={() => navigate('/')}>
          Home
        </button>
        <h1 className="display" ref={heading} tabIndex={-1}>
          History
        </h1>
      </header>
      <div className="seg" role="radiogroup" aria-label="Show">
        {TABS.map(t => (
          <button key={t.id} type="button" role="radio" aria-checked={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <section className="history__body" aria-live={!local && load.kind !== 'ok' ? 'polite' : 'off'}>{body}</section>
    </main>
  );
}

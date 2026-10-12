import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { getService } from '../net/service';
import { normalizeCode } from '../net/connection';
import { getIdentity } from '../net/identity';
import { coachEnabled, usePrefs } from '../store/prefs';
import { ProfileForm } from '../ui/ProfileForm';
import { SettingsSheet } from './SettingsSheet';
import { RulesSheet } from './RulesSheet';
import './home.css';

const RESUME_WINDOW_MS = 24 * 60 * 60 * 1000;

const isNetworkError = (e: unknown): boolean => (e as { kind?: string } | null)?.kind === 'network';

function useResume(): string | null {
  const last = usePrefs(s => s.lastRoom);
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    if (!last || Date.now() - last.at > RESUME_WINDOW_MS) return;
    let alive = true;
    getService()
      .then(svc => svc.roomExists(last.code))
      .then(r => {
        if (alive && r.exists && r.status !== 'finished') setCode(last.code);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [last]);
  return code;
}

export default function Home() {
  const p = usePrefs();
  const [, navigate] = useLocation();
  const [code, setCode] = useState('');
  const [error, setError] = useState<{ text: string; retry?: () => void } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<'settings' | 'rules' | null>(null);
  const resume = useResume();

  if (!p.name) {
    return (
      <main className="screen home">
        <h1 className="display home__brand">Tysiąc</h1>
        <p>Welcome! Pick a name and an avatar — friends will see them at the table.</p>
        <ProfileForm initialName="" initialAvatar={p.avatar} submitLabel="Continue" onSubmit={(n, a) => p.setProfile(n, a)} />
      </main>
    );
  }

  const create = async (maxPlayers: 3 | 4, practice: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const svc = await getService();
      const me = getIdentity();
      const res = await svc.createRoom({ maxPlayers, playerId: me.playerId, name: p.name, avatar: p.avatar });
      p.setLastRoom({ code: res.code, practice, at: Date.now() });
      navigate(`/r/${res.code}`);
    } catch (e) {
      setError(
        isNetworkError(e)
          ? { text: "Can't reach the server", retry: () => void create(maxPlayers, practice) }
          : { text: "Couldn't create a room. Try again." },
      );
    } finally {
      setBusy(false);
    }
  };

  const join = async (e?: FormEvent) => {
    e?.preventDefault();
    const c = normalizeCode(code);
    if (!c) {
      setError({ text: 'A room code has 6 letters or digits.' });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await (await getService()).roomExists(c);
      if (r.exists) navigate(`/r/${c}`);
      else setError({ text: `No room with code ${c}.` });
    } catch {
      setError({ text: "Can't reach the server", retry: () => void join() });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="screen home">
      <h1 className="display home__brand">Tysiąc</h1>
      <p className="home__hello">
        Hi {p.avatar} {p.name}
      </p>
      {resume && (
        <div className="panel home__resume">
          <span>Game {resume} is still on.</span>
          <button type="button" className="btn btn--pri" onClick={() => navigate(`/r/${resume}`)}>
            Resume
          </button>
        </div>
      )}
      <section>
        <div className="lbl">New game</div>
        <div className="row">
          <button type="button" className="btn btn--pri" disabled={busy} onClick={() => void create(3, false)}>
            3 players
          </button>
          <button type="button" className="btn btn--pri" disabled={busy} onClick={() => void create(4, false)}>
            4 players
          </button>
        </div>
      </section>
      <form className="home__join" onSubmit={e => void join(e)}>
        <label className="field">
          <span className="lbl">Join with code</span>
          <input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={6}
            placeholder="K7QX2M"
            enterKeyHint="go"
          />
        </label>
        <button type="submit" className="btn btn--sec" disabled={busy}>
          Join
        </button>
      </form>
      <button type="button" className="btn btn--sec" disabled={busy} onClick={() => void create(3, true)}>
        Practice vs bots
      </button>
      <div className="row">
        <Link href="/learn" className="btn btn--sec">
          Learn to play
        </Link>
        <Link href="/history" className="btn btn--sec">
          History
        </Link>
      </div>
      <button type="button" className="btn btn--sec" onClick={() => setSheet('settings')}>
        Settings
      </button>
      {error && (
        <p className="home__error" role="alert">
          {error.text}{' '}
          {error.retry && (
            <button type="button" className="btn btn--sec" onClick={error.retry}>
              Retry
            </button>
          )}
        </p>
      )}
      {sheet === 'settings' && (
        <SettingsSheet allowProfile coachOn={coachEnabled(p, false)} onCoachChange={p.setCoach} onRules={() => setSheet('rules')} onClose={() => setSheet(null)} />
      )}
      {sheet === 'rules' && <RulesSheet onClose={() => setSheet(null)} />}
    </main>
  );
}

import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { getService } from '../net/service';
import { normalizeCode } from '../net/connection';
import { createRoomAs } from '../net/rooms';
import { coachEnabled, usePrefs } from '../store/prefs';
import { ProfileForm } from '../ui/ProfileForm';
import { SettingsSheet } from './SettingsSheet';
import { RulesSheet } from './RulesSheet';
import { useT } from '../i18n/useT';
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
  const t = useT();
  const [, navigate] = useLocation();
  const [code, setCode] = useState('');
  // The error text is computed at render time so it follows a language switch.
  const [error, setError] = useState<{ text: () => string; retry?: () => void } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<'settings' | 'rules' | null>(null);
  const resume = useResume();

  if (!p.name) {
    return (
      <main className="screen home">
        <h1 className="display home__brand">Tysiąc</h1>
        <p>{t('screens.home.welcome')}</p>
        <ProfileForm initialName="" initialAvatar={p.avatar} submitLabel={t('screens.home.continue')} onSubmit={(n, a) => p.setProfile(n, a)} />
      </main>
    );
  }

  const create = async (maxPlayers: 3 | 4, practice: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const roomCode = await createRoomAs(maxPlayers, practice);
      navigate(`/r/${roomCode}`);
    } catch (e) {
      setError(
        isNetworkError(e)
          ? { text: () => t('errors.unreachable'), retry: () => void create(maxPlayers, practice) }
          : { text: () => t('errors.createFailed') },
      );
    } finally {
      setBusy(false);
    }
  };

  const join = async (e?: FormEvent) => {
    e?.preventDefault();
    const c = normalizeCode(code);
    if (!c) {
      setError({ text: () => t('errors.badCode') });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await (await getService()).roomExists(c);
      if (r.exists) navigate(`/r/${c}`);
      else setError({ text: () => t('errors.noRoom', { code: c }) });
    } catch {
      setError({ text: () => t('errors.unreachable'), retry: () => void join() });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="screen home">
      <h1 className="display home__brand">Tysiąc</h1>
      <p className="home__hello">{t('screens.home.hello', { avatar: p.avatar, name: p.name })}</p>
      {resume && (
        <div className="panel home__resume">
          <span>{t('screens.home.resumeText', { code: resume })}</span>
          <button type="button" className="btn btn--pri" onClick={() => navigate(`/r/${resume}`)}>
            {t('screens.home.resume')}
          </button>
        </div>
      )}
      <section>
        <div className="lbl">{t('screens.home.newGame')}</div>
        <div className="row">
          <button type="button" className="btn btn--pri" disabled={busy} onClick={() => void create(3, false)}>
            {t('screens.home.players3')}
          </button>
          <button type="button" className="btn btn--pri" disabled={busy} onClick={() => void create(4, false)}>
            {t('screens.home.players4')}
          </button>
        </div>
      </section>
      <form className="home__join" onSubmit={e => void join(e)}>
        <label className="field">
          <span className="lbl">{t('screens.home.joinLabel')}</span>
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
          {t('screens.home.join')}
        </button>
      </form>
      <button type="button" className="btn btn--sec" disabled={busy} onClick={() => void create(3, true)}>
        {t('screens.home.practice')}
      </button>
      <div className="row">
        <Link href="/learn" className="btn btn--sec">
          {t('screens.home.learn')}
        </Link>
        <Link href="/history" className="btn btn--sec">
          {t('screens.home.history')}
        </Link>
      </div>
      <button type="button" className="btn btn--sec" onClick={() => setSheet('settings')}>
        {t('common.settings')}
      </button>
      {error && (
        <p className="home__error" role="alert">
          {error.text()}{' '}
          {error.retry && (
            <button type="button" className="btn btn--sec" onClick={error.retry}>
              {t('common.retry')}
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

import { lazy, useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { PROTOCOL_VERSION } from '../net/protocol';
import { FATAL_ERRORS, normalizeCode } from '../net/connection';
import { installSounds } from '../audio/sounds';
import { getService } from '../net/service';
import { getIdentity } from '../net/identity';
import { coachForRoom, usePrefs } from '../store/prefs';
import { useRoom } from '../store/room';
import { ProfileForm } from '../ui/ProfileForm';
import { Placeholder } from './Placeholder';
import { usePracticeAutostart } from './practiceAutostart';
import { useT } from '../i18n/useT';
import { tAny, type MsgKey } from '../i18n';
import './home.css';

const Lobby = lazy(() => import('./Lobby'));
const Game = lazy(() => import('./Game'));

/** First connect gives up (offers Retry) after this long without a welcome. */
const CONNECT_TIMEOUT_MS = 8000;

const FATAL_TEXT: Partial<Record<string, MsgKey>> = {
  roomFull: 'errors.roomFull',
  gameInProgress: 'errors.gameInProgress',
  badSecret: 'errors.badSecret',
  versionMismatch: 'errors.versionMismatch',
  notInRoom: 'errors.notInRoom',
  badMessage: 'errors.badMessage',
  notHost: 'errors.notHost',
  rateLimited: 'errors.rateLimited',
};

function fatalText(code: string, message: string): string {
  const key = FATAL_TEXT[code];
  return key ? tAny(key) : message;
}

export default function RoomRoute({ code }: { code: string }) {
  useEffect(() => {
    installSounds();
  }, []);
  const t = useT();
  const norm = normalizeCode(code);
  const name = usePrefs(s => s.name);
  const avatar = usePrefs(s => s.avatar);
  const setProfile = usePrefs(s => s.setProfile);
  const practice = usePrefs(s => !!norm && s.lastRoom !== null && s.lastRoom.code === norm && s.lastRoom.practice);
  const room = useRoom(s => s.room);
  const view = useRoom(s => s.view);
  const status = useRoom(s => s.status);
  const error = useRoom(s => s.error);
  const conn = useRoom(s => s.conn);
  const [, navigate] = useLocation();
  /** Bumped by "Use here" / "Retry" to open a fresh connection. */
  const [attempt, setAttempt] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [stalled, setStalled] = useState(false);
  const connected = room !== null;

  useEffect(() => {
    if (!norm || !name) return;
    let alive = true;
    setLoadFailed(false);
    void getService().then(svc => {
      if (!alive) return;
      const conn = svc.connect(norm, () => {
        const p = usePrefs.getState();
        const me = getIdentity();
        // Read live: turning the coach off in-game (setCoach) clears the forced flag, and that must stick on reconnect.
        const forceCoach = p.lastRoom?.code === norm && p.lastRoom.coach === true;
        return { t: 'hello', v: PROTOCOL_VERSION, playerId: me.playerId, secret: me.secret, name: p.name, avatar: p.avatar, coach: forceCoach || coachForRoom(norm, p, practice) };
      });
      useRoom.getState().attach(conn);
      const last = usePrefs.getState().lastRoom;
      const keepForce = last?.code === norm && last.coach === true;
      usePrefs.getState().setLastRoom({ code: norm, practice, at: Date.now(), ...(keepForce ? { coach: true } : {}) });
    }).catch(() => {
      if (alive) setLoadFailed(true);
    });
    return () => {
      alive = false;
      useRoom.getState().detach();
    };
  }, [norm, name, practice, attempt]);

  // No welcome within CONNECT_TIMEOUT_MS of (re)starting a connection -> offer Retry.
  useEffect(() => {
    if (connected || !norm || !name) {
      setStalled(false);
      return;
    }
    const timer = setTimeout(() => setStalled(true), CONNECT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [connected, norm, name, attempt]);

  usePracticeAutostart(practice);

  useEffect(() => {
    if (norm && room?.status === 'playing') usePrefs.getState().noteGameStarted(norm);
  }, [norm, room?.status]);

  if (!norm) return <Placeholder title={t('screens.room.badCode')} text={t('screens.room.badCodeText')} back />;
  if (!name) {
    return (
      <main className="screen">
        <h1 className="display">{t('screens.room.join', { code: norm })}</h1>
        <ProfileForm initialName="" initialAvatar={avatar} submitLabel={t('screens.home.join')} onSubmit={setProfile} />
      </main>
    );
  }
  const goHome = (
    <button type="button" className="btn btn--pri" onClick={() => navigate('/')}>
      {t('common.home')}
    </button>
  );
  const unreachable = loadFailed || (!room && (stalled || status === 'reconnecting')) && !(error && FATAL_ERRORS.has(error.code)) && status !== 'closed';
  if (unreachable) {
    return (
      <main className="screen">
        <h1 className="display">{t('errors.unreachable')}</h1>
        <p>{t('screens.room.checkConnection')}</p>
        <button type="button" className="btn btn--pri" onClick={() => {
            setStalled(false);
            setAttempt(a => a + 1);
          }}>
          {t('common.retry')}
        </button>
        <button type="button" className="btn btn--sec" onClick={() => navigate('/')}>
          {t('common.home')}
        </button>
      </main>
    );
  }
  if (status === 'closed' && conn?.closeReason === 'replaced') {
    return (
      <main className="screen">
        <h1 className="display">{t('screens.room.otherTab')}</h1>
        <p>{t('screens.room.otherTabText')}</p>
        <button type="button" className="btn btn--pri" onClick={() => setAttempt(a => a + 1)}>
          {t('screens.room.useHere')}
        </button>
        <button type="button" className="btn btn--sec" onClick={() => navigate('/')}>
          {t('common.home')}
        </button>
      </main>
    );
  }
  if (error && FATAL_ERRORS.has(error.code)) {
    return (
      <main className="screen">
        <h1 className="display">{t('screens.room.cantJoin')}</h1>
        <p>{fatalText(error.code, error.message)}</p>
        {goHome}
      </main>
    );
  }
  if (status === 'closed' && (conn?.closeReason === 'protocol' || conn?.closeReason === 'rejected')) {
    return (
      <main className="screen">
        <h1 className="display">{t('screens.room.closed')}</h1>
        <p>{conn.closeReason === 'protocol' ? t('screens.room.outOfSync') : t('screens.room.refused')}</p>
        {goHome}
      </main>
    );
  }
  return (
    <>
      {status === 'reconnecting' && (
        <div className="netbanner" role="status">
          {t('screens.room.reconnecting')}
        </div>
      )}
      {!room ? (
        <Placeholder title={norm} text={t('screens.room.connecting')} />
      ) : room.status === 'lobby' ? (
        <Lobby />
      ) : view ? (
        <Game />
      ) : (
        <Placeholder title={norm} text={t('game.dealing')} />
      )}
    </>
  );
}

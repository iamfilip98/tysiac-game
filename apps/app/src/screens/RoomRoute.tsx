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
import './home.css';

const Lobby = lazy(() => import('./Lobby'));
const Game = lazy(() => import('./Game'));

/** First connect gives up (offers Retry) after this long without a welcome. */
const CONNECT_TIMEOUT_MS = 8000;

const FATAL_TEXT: Record<string, string> = {
  roomFull: 'This room is full.',
  gameInProgress: 'This game has already started without you.',
  badSecret: 'This seat belongs to another device.',
  versionMismatch: 'The app was updated — please reload.',
  notInRoom: 'No such room — it may have expired.',
};

export default function RoomRoute({ code }: { code: string }) {
  useEffect(() => {
    installSounds();
  }, []);
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
    const t = setTimeout(() => setStalled(true), CONNECT_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [connected, norm, name, attempt]);

  usePracticeAutostart(practice);

  useEffect(() => {
    if (norm && room?.status === 'playing') usePrefs.getState().noteGameStarted(norm);
  }, [norm, room?.status]);

  if (!norm) return <Placeholder title="Bad room code" text="Room codes have 6 letters or digits." back />;
  if (!name) {
    return (
      <main className="screen">
        <h1 className="display">Join game {norm}</h1>
        <ProfileForm initialName="" initialAvatar={avatar} submitLabel="Join" onSubmit={setProfile} />
      </main>
    );
  }
  const goHome = (
    <button type="button" className="btn btn--pri" onClick={() => navigate('/')}>
      Home
    </button>
  );
  const unreachable = loadFailed || (!room && (stalled || status === 'reconnecting')) && !(error && FATAL_ERRORS.has(error.code)) && status !== 'closed';
  if (unreachable) {
    return (
      <main className="screen">
        <h1 className="display">Can't reach the server</h1>
        <p>Check your connection and try again.</p>
        <button type="button" className="btn btn--pri" onClick={() => {
            setStalled(false);
            setAttempt(a => a + 1);
          }}>
          Retry
        </button>
        <button type="button" className="btn btn--sec" onClick={() => navigate('/')}>
          Home
        </button>
      </main>
    );
  }
  if (status === 'closed' && conn?.closeReason === 'replaced') {
    return (
      <main className="screen">
        <h1 className="display">Opened in another tab</h1>
        <p>This game is open somewhere else. Only one tab can play at a time.</p>
        <button type="button" className="btn btn--pri" onClick={() => setAttempt(a => a + 1)}>
          Use here
        </button>
        <button type="button" className="btn btn--sec" onClick={() => navigate('/')}>
          Home
        </button>
      </main>
    );
  }
  if (error && FATAL_ERRORS.has(error.code)) {
    return (
      <main className="screen">
        <h1 className="display">Can't join</h1>
        <p>{FATAL_TEXT[error.code] ?? error.message}</p>
        {goHome}
      </main>
    );
  }
  if (status === 'closed' && (conn?.closeReason === 'protocol' || conn?.closeReason === 'rejected')) {
    return (
      <main className="screen">
        <h1 className="display">Connection closed</h1>
        <p>
          {conn.closeReason === 'protocol'
            ? 'The app and the server are out of sync — please reload the page.'
            : 'The server refused this connection.'}
        </p>
        {goHome}
      </main>
    );
  }
  return (
    <>
      {status === 'reconnecting' && (
        <div className="netbanner" role="status">
          Reconnecting…
        </div>
      )}
      {!room ? (
        <Placeholder title={norm} text="Connecting…" />
      ) : room.status === 'lobby' ? (
        <Lobby />
      ) : view ? (
        <Game />
      ) : (
        <Placeholder title={norm} text="Dealing…" />
      )}
    </>
  );
}

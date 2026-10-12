import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import type { AdviseOptions, PlayerView } from '@tysiac/engine';
import { LocalHub, localService } from '../net/localService';
import { isFastLocal } from '../net/service';
import { createRoomAs } from '../net/rooms';
import { PROTOCOL_VERSION } from '../net/protocol';
import { usePrefs } from '../store/prefs';
import { useRoom } from '../store/room';
import { isIdle } from '../store/client';
import { Sheet } from '../ui/Sheet';
import { ProfileForm } from '../ui/ProfileForm';
import { Placeholder } from './Placeholder';
import { usePracticeAutostart } from './practiceAutostart';
import Game from './Game';
import { Gate, gatedClock } from '../learn/gate';
import { LessonConnection } from '../learn/LessonConnection';
import { LessonContext, type LessonControl } from '../learn/context';
import { LEARNER_ID, LESSON_SECRET, LESSON_SEED, buildLesson, expectedAt, lessonBotMove } from '../learn/lesson';
import { describeExpected, lessonAdvice, lessonHint, nextBeat } from '../learn/beats';
import './learn.css';

export default function Learn() {
  const name = usePrefs(s => s.name);
  const avatar = usePrefs(s => s.avatar);
  const setProfile = usePrefs(s => s.setProfile);
  const [, navigate] = useLocation();
  const lesson = useMemo(() => buildLesson(LESSON_SEED), []);
  const gate = useMemo(() => new Gate(), []);
  const [seen, setSeen] = useState<readonly string[]>([]);
  const [practiceError, setPracticeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const room = useRoom(s => s.room);
  const shown = useRoom(s => s.shown);
  const roundResult = useRoom(s => s.roundResult);
  const idle = useRoom(s => isIdle(s));

  useEffect(() => {
    if (!name) return;
    const hub = new LocalHub({ clock: gatedClock(gate), botDelayScale: isFastLocal() ? 0.05 : 1 });
    const code = hub.create({ maxPlayers: 3, playerId: LEARNER_ID, name, avatar }, { seed: LESSON_SEED, botMove: lessonBotMove(lesson) });
    const inner = localService(hub).connect(code, () => ({
      t: 'hello', v: PROTOCOL_VERSION, playerId: LEARNER_ID, secret: LESSON_SECRET, name, avatar, coach: false,
    }));
    useRoom.getState().attach(new LessonConnection(inner, { expectedAt: seq => expectedAt(lesson, seq), hint: lessonHint }));
    setSeen([]);
    return () => {
      useRoom.getState().detach();
      hub.get(code)?.dispose();
      gate.set(true);
    };
  }, [name, avatar, lesson, gate]);

  usePracticeAutostart(true);

  const beat = shown && !roundResult ? nextBeat(shown, seen) : null;
  useEffect(() => {
    gate.set(beat === null);
  }, [gate, beat]);

  const control = useMemo<LessonControl>(() => ({ advice: (v: PlayerView, opts?: AdviseOptions) => lessonAdvice(v, expectedAt(lesson, v.seq), opts) }), [lesson]);
  const expected = shown && idle && !beat && shown.turn === shown.me ? expectedAt(lesson, shown.seq) : null;

  if (!name) {
    return (
      <main className="screen">
        <h1 className="display">Learn to play</h1>
        <ProfileForm initialName="" initialAvatar={avatar} submitLabel="Start" onSubmit={setProfile} />
      </main>
    );
  }
  if (!room || room.status === 'lobby' || !shown) return <Placeholder title="Learn to play" text="Shuffling…" />;

  const practice = async () => {
    setBusy(true);
    setPracticeError(null);
    try {
      const code = await createRoomAs(3, true, true);
      navigate(`/r/${code}`);
    } catch {
      setPracticeError("Can't reach the server. Try again.");
      setBusy(false);
    }
  };
  const done = () => beat && setSeen(s => [...s, beat.id]);

  return (
    <LessonContext.Provider value={control}>
      <Game />
      <div hidden data-testid="lesson" data-beat={beat?.id ?? ''} data-expected={expected && shown ? JSON.stringify(describeExpected(shown, expected)) : ''} />
      {beat && (
        <Sheet
          title={beat.title(shown)}
          onClose={beat.final ? () => navigate('/') : done}
          footer={
            beat.final ? (
              <div className="lesson__actions">
                <button type="button" className="btn btn--pri" disabled={busy} onClick={() => void practice()}>
                  Practice with coach
                </button>
                <button type="button" className="btn btn--sec" onClick={() => navigate('/')}>
                  Home
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn--pri" onClick={done}>
                Next
              </button>
            )
          }
        >
          <div className="lesson">
            {beat.body(shown).map((line, i) => (
              <p key={i}>{line}</p>
            ))}
            {practiceError && (
              <p className="lesson__error" role="alert">
                {practiceError}
              </p>
            )}
          </div>
        </Sheet>
      )}
    </LessonContext.Provider>
  );
}

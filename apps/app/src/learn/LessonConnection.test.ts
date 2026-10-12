import { describe, expect, it } from 'vitest';
import type { Action, PlayerView } from '@tysiac/engine';
import { LessonConnection } from './LessonConnection';
import { FakeConnection } from '../test/fakes';
import type { ServerMessage } from '../net/protocol';

const bid110: Action = { type: 'bid', amount: 110 };
function setup(expected: Action | null) {
  const inner = new FakeConnection();
  const hints: { expected: Action | null; tried: Action }[] = [];
  const conn = new LessonConnection(inner, {
    expectedAt: () => expected,
    hint: (_v, e, tried) => {
      hints.push({ expected: e, tried });
      return 'Lesson: Bid 110.';
    },
  });
  const got: ServerMessage[] = [];
  conn.onMessage(m => got.push(m));
  inner.push({ t: 'state', seq: 3, view: { seq: 3 } as PlayerView, events: [] });
  return { inner, conn, got, hints };
}
const tick = () => new Promise(r => setTimeout(r, 0));

describe('LessonConnection', () => {
  it('relays server messages and non-act client messages', () => {
    const { inner, conn, got } = setup(bid110);
    expect(got.map(m => m.t)).toEqual(['state']);
    expect(conn.send({ t: 'lobby', op: { op: 'addBot' } })).toBe(true);
    expect(inner.sent).toEqual([{ t: 'lobby', op: { op: 'addBot' } }]);
  });

  it('forwards the scripted act', () => {
    const { inner, conn } = setup(bid110);
    expect(conn.send({ t: 'act', id: 'a1', action: { type: 'bid', amount: 110 } })).toBe(true);
    expect(inner.acts()).toHaveLength(1);
  });

  it('an off-script act is rejected locally with the lesson hint', async () => {
    const { inner, conn, got, hints } = setup(bid110);
    expect(conn.send({ t: 'act', id: 'a2', action: { type: 'pass' } })).toBe(true);
    expect(inner.acts()).toHaveLength(0);
    await tick();
    expect(got.at(-1)).toEqual({ t: 'reject', id: 'a2', code: 'lesson', message: 'Lesson: Bid 110.' });
    expect(hints).toEqual([{ expected: bid110, tried: { type: 'pass' } }]);
  });

  it('pause is never forwarded', async () => {
    const { inner, conn, got } = setup(bid110);
    conn.send({ t: 'act', id: 'p', action: { type: 'pause' } });
    await tick();
    expect(inner.acts()).toHaveLength(0);
    expect(got.at(-1)).toMatchObject({ t: 'reject', id: 'p', code: 'lesson' });
  });

  it('when nothing is expected every act is rejected', async () => {
    const { inner, conn, got } = setup(null);
    conn.send({ t: 'act', id: 'x', action: bid110 });
    await tick();
    expect(inner.acts()).toHaveLength(0);
    expect(got.at(-1)).toMatchObject({ t: 'reject', id: 'x' });
  });

  it('returns false when the inner link is not open', () => {
    const { inner, conn } = setup(bid110);
    inner.setStatus('reconnecting');
    expect(conn.send({ t: 'act', id: 'a', action: bid110 })).toBe(false);
  });

  it('close() closes the inner connection and stops relaying', () => {
    const { inner, conn, got } = setup(bid110);
    conn.close();
    expect(inner.status).toBe('closed');
    inner.push({ t: 'pong' });
    expect(got.map(m => m.t)).toEqual(['state']);
  });
});

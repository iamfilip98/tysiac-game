import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { REPEAT_MIN_MS, REPEAT_SOFT_MS, SOUND_FILES, SYNTH, SoundPlayer, installSounds, synthSeconds, type AudioContextLike } from './sounds';
import type { SoundName } from '../store/client';

function fakeCtx() {
  const started: string[] = [];
  const raw = {
    state: 'suspended' as AudioContextState,
    currentTime: 0,
    destination: {} as AudioDestinationNode,
    resume: vi.fn(async () => {
      raw.state = 'running';
    }),
    decodeAudioData: vi.fn(async () => ({ duration: 0.2 }) as AudioBuffer),
    createBufferSource: vi.fn(() => ({ buffer: null as AudioBuffer | null, connect: vi.fn(), start: () => started.push('sample') })),
    createGain: vi.fn(() => ({ gain: { value: 1, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() })),
    createOscillator: vi.fn(() => ({ type: 'sine', frequency: { value: 0 }, connect: vi.fn(), start: () => started.push('synth'), stop: vi.fn() })),
  };
  return { ctx: raw as unknown as AudioContextLike, raw, started };
}

describe('SoundPlayer', () => {
  it('plays the decoded sample once preloaded', async () => {
    const { ctx, started } = fakeCtx();
    const fetcher = vi.fn(async () => new Response(new ArrayBuffer(8)));
    const p = new SoundPlayer(() => true, () => ctx, fetcher);
    await p.preload();
    expect(fetcher).toHaveBeenCalledTimes(Object.keys(SOUND_FILES).length);
    expect(fetcher).toHaveBeenCalledWith('/sounds/card.m4a');
    p.play('card');
    expect(started).toEqual(['sample']);
  });

  it('falls back to a synthesized sound when a file is missing', async () => {
    const { ctx, started } = fakeCtx();
    const p = new SoundPlayer(() => true, () => ctx, async () => new Response('', { status: 404 }));
    await p.preload();
    p.play('turn');
    expect(started.length).toBeGreaterThan(0);
    expect(started.every(s => s === 'synth')).toBe(true);
  });

  it('is silent when sound is off', async () => {
    const { ctx, started } = fakeCtx();
    const p = new SoundPlayer(() => false, () => ctx, async () => new Response(new ArrayBuffer(8)));
    await p.preload();
    p.play('card');
    expect(started).toEqual([]);
  });

  it('unlock resumes a suspended context', () => {
    const { ctx, raw } = fakeCtx();
    const p = new SoundPlayer(() => true, () => ctx, async () => new Response(new ArrayBuffer(8)));
    p.unlock();
    expect(raw.resume).toHaveBeenCalled();
  });

  it('does nothing without Web Audio', () => {
    const p = new SoundPlayer(() => true, () => null, async () => new Response(new ArrayBuffer(8)));
    expect(() => p.play('card')).not.toThrow();
  });

  it('resumes an interrupted context on unlock and on play', () => {
    const { ctx, raw } = fakeCtx();
    (raw as { state: string }).state = 'interrupted';
    const p = new SoundPlayer(() => true, () => ctx, async () => new Response('', { status: 404 }));
    p.unlock();
    expect(raw.resume).toHaveBeenCalledTimes(1);
    (raw as { state: string }).state = 'interrupted';
    p.play('card');
    expect(raw.resume).toHaveBeenCalledTimes(2);
  });

  it('does not resume a running context', () => {
    const { ctx, raw } = fakeCtx();
    (raw as { state: string }).state = 'running';
    new SoundPlayer(() => true, () => ctx, async () => new Response('', { status: 404 })).play('card');
    expect(raw.resume).not.toHaveBeenCalled();
  });

  it('retries a failed preload on the next call', async () => {
    const { ctx, started } = fakeCtx();
    let ok = false;
    const fetcher = vi.fn(async () => (ok ? new Response(new ArrayBuffer(8)) : new Response('', { status: 503 })));
    let t = 0;
    const p = new SoundPlayer(() => true, () => ctx, fetcher, () => (t += 1000));
    await p.preload();
    p.play('card');
    expect(started).toEqual(['synth']);
    ok = true;
    await p.preload();
    expect(fetcher).toHaveBeenCalledTimes(2 * Object.keys(SOUND_FILES).length);
    p.play('card');
    expect(started).toEqual(['synth', 'sample']);
  });
});

describe('installSounds', () => {
  afterEach(() => vi.restoreAllMocks());

  it('unlocks on pointerdown, touchend and click and resumes when the tab becomes visible', () => {
    const { raw } = fakeCtx();
    class FakeAC {
      constructor() {
        return raw as unknown as FakeAC;
      }
    }
    vi.stubGlobal('AudioContext', FakeAC);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
    installSounds();
    for (const type of ['pointerdown', 'touchend', 'click']) {
      raw.state = 'suspended';
      raw.resume.mockClear();
      window.dispatchEvent(new Event(type));
      expect(raw.resume, type).toHaveBeenCalled();
    }
    raw.state = 'suspended';
    raw.resume.mockClear();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(raw.resume).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

/** Duration (s) from the MP4 'mvhd' box. */
function m4aSeconds(path: string): number {
  const b = readFileSync(path);
  const i = b.indexOf('mvhd');
  const version = b[i + 4];
  const base = i + 8 + (version === 1 ? 16 : 8);
  const timescale = b.readUInt32BE(base);
  const duration = version === 1 ? Number(b.readBigUInt64BE(base + 4)) : b.readUInt32BE(base + 4);
  return duration / timescale;
}

describe('sound assets', () => {
  it('shuffle lasts at most 0.8 s', () => {
    expect(m4aSeconds(join(process.cwd(), 'public/sounds/shuffle.m4a'))).toBeLessThanOrEqual(0.8);
  });
  it('marriage, roundEnd and gameWin are synthesised (no file) and actually schedule notes', () => {
    for (const name of ['marriage', 'roundEnd', 'gameWin'] as const) {
      expect(SOUND_FILES[name]).toBeUndefined();
      const { ctx, started } = fakeCtx();
      new SoundPlayer(() => true, () => ctx, () => Promise.reject(new Error('offline'))).play(name);
      expect(started.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('every game sound', () => {
  const names = Object.keys(SYNTH) as SoundName[];
  it('is short (<= 0.4 s; the game win may be longer)', () => {
    for (const n of names) if (n !== 'gameWin') expect(synthSeconds(SYNTH[n]), n).toBeLessThanOrEqual(0.4);
    expect(synthSeconds(SYNTH.gameWin)).toBeLessThanOrEqual(1.5);
  });
  it('is distinct from every other', () => {
    const recipes = names.map(n => JSON.stringify(SYNTH[n]));
    expect(new Set(recipes).size).toBe(names.length);
  });
  it('keeps a consistent volume', () => {
    for (const n of names) expect(SYNTH[n].vol, n).toBeGreaterThanOrEqual(0.05);
    for (const n of names) expect(SYNTH[n].vol, n).toBeLessThanOrEqual(0.18);
  });
  it('is silent when sound is off', () => {
    const { ctx, started } = fakeCtx();
    const p = new SoundPlayer(() => false, () => ctx, () => Promise.reject(new Error('offline')));
    for (const n of names) p.play(n);
    expect(started).toEqual([]);
  });
  it('a quick repeat (fast bots) plays softer, a near-duplicate is dropped', () => {
    const { ctx, raw } = fakeCtx();
    let now = 0;
    const gains: number[] = [];
    raw.createGain.mockImplementation(() => ({ gain: { value: 1, setValueAtTime: vi.fn((v: number) => { gains.push(v); }), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() }));
    const p = new SoundPlayer(() => true, () => ctx, () => Promise.reject(new Error('offline')), () => now);
    p.play('bid');
    const first = gains[0];
    gains.length = 0;
    now += REPEAT_MIN_MS / 2;
    p.play('bid');
    expect(gains).toEqual([]);
    now += REPEAT_SOFT_MS / 2;
    p.play('bid');
    expect(gains[0]).toBeLessThan(first);
    gains.length = 0;
    now += REPEAT_SOFT_MS * 2;
    p.play('bid');
    expect(gains[0]).toBeCloseTo(first);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { SOUND_FILES, SoundPlayer, type AudioContextLike } from './sounds';

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
});

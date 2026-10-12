import type { SoundName } from '../store/client';
import { setSoundSink } from '../store/room';
import { usePrefs } from '../store/prefs';

export const SOUND_FILES: Partial<Record<SoundName, string>> = {
  card: '/sounds/card.m4a',
  shuffle: '/sounds/shuffle.m4a',
  sweep: '/sounds/sweep.m4a',
  turn: '/sounds/turn.m4a',
};

export type AudioContextLike = Pick<
  AudioContext,
  'state' | 'resume' | 'currentTime' | 'destination' | 'createBufferSource' | 'createGain' | 'createOscillator' | 'decodeAudioData'
>;

interface Note { f: number[]; at: number; dur: number }
interface Synth { type: OscillatorType; vol: number; notes: Note[] }
const seq = (fs: number[], dur: number): Note[] => fs.map((f, i) => ({ f: [f], at: i * dur * 0.6, dur }));

const SYNTH: Record<SoundName, Synth> = {
  card: { type: 'triangle', vol: 0.18, notes: seq([180], 0.06) },
  shuffle: { type: 'sawtooth', vol: 0.05, notes: seq([140, 190, 160], 0.12) },
  sweep: { type: 'triangle', vol: 0.08, notes: seq([320, 240], 0.14) },
  turn: { type: 'sine', vol: 0.1, notes: seq([660, 880], 0.18) },
  marriage: { type: 'sine', vol: 0.08, notes: [{ f: [523, 659, 784], at: 0, dur: 0.4 }, { f: [587, 740, 880], at: 0.3, dur: 0.5 }] },
  roundEnd: { type: 'triangle', vol: 0.08, notes: [{ f: [440, 554, 659], at: 0, dur: 0.6 }] },
  gameWin: {
    type: 'sine', vol: 0.1,
    notes: [...seq([523, 659, 784, 1047], 0.25).map((n, i) => ({ ...n, at: i * 0.15 })), { f: [1047, 1319, 1568], at: 0.6, dur: 0.8 }],
  },
};

function defaultContext(): AudioContextLike | null {
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const C = w.AudioContext ?? w.webkitAudioContext;
  return C ? new C() : null;
}

export class SoundPlayer {
  private ctx: AudioContextLike | null | undefined;
  private readonly buffers = new Map<SoundName, AudioBuffer | 'missing'>();
  private loading: Promise<void> | null = null;

  constructor(
    private readonly enabled: () => boolean,
    private readonly makeCtx: () => AudioContextLike | null = defaultContext,
    private readonly fetcher: (url: string) => Promise<Response> = url => fetch(url),
  ) {}

  /** Call from a user gesture: iOS only starts audio after one. */
  unlock(): void {
    const ctx = this.context();
    if (!ctx) return;
    this.resume();
    void this.preload();
  }

  /** iOS leaves the context 'suspended' or 'interrupted' (backgrounding, calls); resume whenever it is not running. */
  resume(): void {
    const ctx = this.context();
    if (!ctx || ctx.state === 'running') return;
    try {
      void ctx.resume().catch(() => {});
    } catch {
      /* best effort */
    }
  }

  preload(): Promise<void> {
    const ctx = this.context();
    if (!ctx) return Promise.resolve();
    this.loading ??= Promise.all(
      (Object.entries(SOUND_FILES) as [SoundName, string][]).map(async ([name, url]) => {
        try {
          const res = await this.fetcher(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          this.buffers.set(name, await ctx.decodeAudioData(await res.arrayBuffer()));
          return true;
        } catch {
          this.buffers.set(name, 'missing');
          return false;
        }
      }),
    ).then(results => {
      // A failure is not permanent: forget it so the next gesture retries (synth covers meanwhile).
      if (results.includes(false)) {
        this.loading = null;
        for (const [name, b] of this.buffers) if (b === 'missing') this.buffers.delete(name);
      }
    });
    return this.loading;
  }

  play(name: SoundName): void {
    if (!this.enabled()) return;
    const ctx = this.context();
    if (!ctx) return;
    this.resume();
    const buffer = this.buffers.get(name);
    if (buffer && buffer !== 'missing') {
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      gain.gain.value = 0.7;
      src.buffer = buffer;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start();
      return;
    }
    this.synth(ctx, SYNTH[name]);
  }

  private synth(ctx: AudioContextLike, s: Synth): void {
    for (const n of s.notes) {
      for (const f of n.f) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = ctx.currentTime + n.at;
        osc.type = s.type;
        osc.frequency.value = f;
        gain.gain.setValueAtTime(s.vol / Math.sqrt(n.f.length), t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + n.dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + n.dur);
      }
    }
  }

  private context(): AudioContextLike | null {
    if (this.ctx === undefined) {
      try {
        this.ctx = this.makeCtx();
      } catch {
        this.ctx = null;
      }
    }
    return this.ctx;
  }
}

let installed: SoundPlayer | null = null;

export function installSounds(): SoundPlayer {
  if (installed) return installed;
  const player = new SoundPlayer(() => usePrefs.getState().sound);
  const unlock = () => player.unlock();
  for (const type of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(type, unlock, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') player.resume();
  });
  setSoundSink(name => player.play(name));
  installed = player;
  return player;
}

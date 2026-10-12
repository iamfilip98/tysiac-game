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
export interface Synth { type: OscillatorType; vol: number; notes: Note[] }
const seq = (fs: number[], dur: number): Note[] => fs.map((f, i) => ({ f: [f], at: i * dur * 0.6, dur }));

/**
 * Synth recipes. marriage, roundEnd, gameWin, trickWon and wykladana follow the OG app's SOUND_SPECS
 * (packages/game-logic/src/sounds/soundDefinitions.ts), shortened to <= 0.4 s; the rest are new and
 * each has its own contour so events are told apart by ear. card/shuffle/sweep/turn prefer the files.
 */
export const SYNTH: Record<SoundName, Synth> = {
  card: { type: 'triangle', vol: 0.18, notes: seq([180], 0.06) },
  shuffle: { type: 'sawtooth', vol: 0.05, notes: seq([140, 190, 160], 0.12) },
  sweep: { type: 'triangle', vol: 0.08, notes: seq([320, 240], 0.14) },
  turn: { type: 'sine', vol: 0.1, notes: seq([660, 880], 0.18) },
  // Bidding: a short rising pair for a raise, a soft falling pair for a pass, a bright chord for the winner.
  bid: { type: 'triangle', vol: 0.11, notes: [{ f: [587], at: 0, dur: 0.08 }, { f: [784], at: 0.07, dur: 0.12 }] },
  pass: { type: 'sine', vol: 0.09, notes: [{ f: [392], at: 0, dur: 0.1 }, { f: [294], at: 0.08, dur: 0.16 }] },
  bidWon: { type: 'triangle', vol: 0.1, notes: [{ f: [523, 784], at: 0, dur: 0.14 }, { f: [659, 988], at: 0.11, dur: 0.26 }] },
  // Talon: three quick flips. Seen: a single soft tick.
  talon: { type: 'triangle', vol: 0.09, notes: [{ f: [440], at: 0, dur: 0.07 }, { f: [554], at: 0.06, dur: 0.07 }, { f: [659], at: 0.12, dur: 0.12 }] },
  seen: { type: 'sine', vol: 0.08, notes: [{ f: [1047], at: 0, dur: 0.07 }] },
  // Hand-out: down when cards leave, up when one arrives.
  give: { type: 'triangle', vol: 0.1, notes: [{ f: [659], at: 0, dur: 0.09 }, { f: [494], at: 0.08, dur: 0.14 }] },
  receive: { type: 'triangle', vol: 0.1, notes: [{ f: [494], at: 0, dur: 0.09 }, { f: [740], at: 0.08, dur: 0.18 }] },
  // OG trickWon (triangle C-E-G arpeggio); a trump win is the same shape higher and brighter.
  trickWon: { type: 'triangle', vol: 0.09, notes: [{ f: [523], at: 0, dur: 0.14 }, { f: [659], at: 0.1, dur: 0.14 }, { f: [784], at: 0.2, dur: 0.18 }] },
  trumpWin: { type: 'sine', vol: 0.1, notes: [{ f: [784], at: 0, dur: 0.12 }, { f: [1047], at: 0.08, dur: 0.12 }, { f: [1319, 1568], at: 0.16, dur: 0.22 }] },
  throw: { type: 'sine', vol: 0.09, notes: [{ f: [330], at: 0, dur: 0.14 }, { f: [262], at: 0.12, dur: 0.14 }, { f: [196], at: 0.24, dur: 0.16 }] },
  marriage: { type: 'sine', vol: 0.08, notes: [{ f: [523, 659, 784], at: 0, dur: 0.22 }, { f: [587, 740, 880], at: 0.16, dur: 0.24 }] },
  wykladana: { type: 'sine', vol: 0.1, notes: [{ f: [392, 494, 587], at: 0, dur: 0.16 }, { f: [523, 659, 784, 1047], at: 0.13, dur: 0.27 }] },
  roundEnd: { type: 'triangle', vol: 0.08, notes: [{ f: [440, 554, 659], at: 0, dur: 0.4 }] },
  gameWin: {
    type: 'sine', vol: 0.1,
    notes: [...seq([523, 659, 784, 1047], 0.25).map((n, i) => ({ ...n, at: i * 0.15 })), { f: [1047, 1319, 1568], at: 0.6, dur: 0.8 }],
  },
};

/** Audible length of a synth recipe (s). */
export const synthSeconds = (s: Synth): number => Math.max(...s.notes.map(n => n.at + n.dur));

/** The same sound again within this window plays softer; closer than MIN_GAP it is dropped (fast bots). */
export const REPEAT_SOFT_MS = 400;
export const REPEAT_MIN_MS = 70;

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
    private readonly clock: () => number = () => performance.now(),
  ) {}

  private readonly lastAt = new Map<SoundName, number>();

  /** 1 normally, softer for a quick repeat of the same sound, 0 (skip) for a near-duplicate. */
  private level(name: SoundName): number {
    const now = this.clock();
    const last = this.lastAt.get(name);
    if (last !== undefined && now - last < REPEAT_MIN_MS) return 0;
    this.lastAt.set(name, now);
    return last !== undefined && now - last < REPEAT_SOFT_MS ? 0.55 : 1;
  }

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
    const level = this.level(name);
    if (level === 0) return;
    this.resume();
    const buffer = this.buffers.get(name);
    if (buffer && buffer !== 'missing') {
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      gain.gain.value = 0.7 * level;
      src.buffer = buffer;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start();
      return;
    }
    this.synth(ctx, SYNTH[name], level);
  }

  private synth(ctx: AudioContextLike, s: Synth, level: number): void {
    for (const n of s.notes) {
      for (const f of n.f) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = ctx.currentTime + n.at;
        osc.type = s.type;
        osc.frequency.value = f;
        gain.gain.setValueAtTime((s.vol * level) / Math.sqrt(n.f.length), t);
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

export type OscType = 'sine' | 'triangle';

export interface ToneSpec {
  frequency: number;
  duration: number;
  type: OscType;
  volume: number;
  delay?: number;
}

export interface SoundSpec {
  priority: number;
  durationMs: number;
  tones: ToneSpec[];
}

export const SOUND_SPECS = {
  yourTurn: {
    priority: 2,
    durationMs: 320,
    tones: [
      { frequency: 880, duration: 0.15, type: 'sine' as const, volume: 0.12 },
      { frequency: 1100, duration: 0.2, type: 'sine' as const, volume: 0.12, delay: 120 },
    ],
  },
  bid: {
    priority: 1,
    durationMs: 100,
    tones: [
      { frequency: 660, duration: 0.1, type: 'triangle' as const, volume: 0.1 },
    ],
  },
  trickWon: {
    priority: 3,
    durationMs: 400,
    tones: [
      { frequency: 523, duration: 0.15, type: 'triangle' as const, volume: 0.1 },
      { frequency: 659, duration: 0.15, type: 'triangle' as const, volume: 0.1, delay: 100 },
      { frequency: 784, duration: 0.2, type: 'triangle' as const, volume: 0.1, delay: 200 },
    ],
  },
  marriage: {
    priority: 4,
    durationMs: 800,
    tones: [
      // Chord 1
      { frequency: 523, duration: 0.4, type: 'sine' as const, volume: 0.08 },
      { frequency: 659, duration: 0.4, type: 'sine' as const, volume: 0.08 },
      { frequency: 784, duration: 0.4, type: 'sine' as const, volume: 0.08 },
      // Chord 2
      { frequency: 587, duration: 0.5, type: 'sine' as const, volume: 0.08, delay: 300 },
      { frequency: 740, duration: 0.5, type: 'sine' as const, volume: 0.08, delay: 300 },
      { frequency: 880, duration: 0.5, type: 'sine' as const, volume: 0.08, delay: 300 },
    ],
  },
  roundEnd: {
    priority: 6,
    durationMs: 600,
    tones: [
      { frequency: 440, duration: 0.6, type: 'triangle' as const, volume: 0.08 },
      { frequency: 554, duration: 0.6, type: 'triangle' as const, volume: 0.08 },
      { frequency: 659, duration: 0.6, type: 'triangle' as const, volume: 0.08 },
    ],
  },
  gameWin: {
    priority: 7,
    durationMs: 1400,
    tones: [
      { frequency: 523, duration: 0.3, type: 'sine' as const, volume: 0.12 },
      { frequency: 659, duration: 0.3, type: 'sine' as const, volume: 0.12, delay: 150 },
      { frequency: 784, duration: 0.3, type: 'sine' as const, volume: 0.12, delay: 300 },
      { frequency: 1047, duration: 0.3, type: 'sine' as const, volume: 0.12, delay: 450 },
      // Final chord
      { frequency: 1047, duration: 0.8, type: 'sine' as const, volume: 0.1, delay: 600 },
      { frequency: 1319, duration: 0.8, type: 'sine' as const, volume: 0.1, delay: 600 },
      { frequency: 1568, duration: 0.8, type: 'sine' as const, volume: 0.1, delay: 600 },
    ],
  },
  wykladana: {
    priority: 5,
    durationMs: 1050,
    tones: [
      // Chord 1
      { frequency: 392, duration: 0.3, type: 'sine' as const, volume: 0.1 },
      { frequency: 494, duration: 0.3, type: 'sine' as const, volume: 0.1 },
      { frequency: 587, duration: 0.3, type: 'sine' as const, volume: 0.1 },
      // Chord 2
      { frequency: 523, duration: 0.8, type: 'sine' as const, volume: 0.1, delay: 250 },
      { frequency: 659, duration: 0.8, type: 'sine' as const, volume: 0.1, delay: 250 },
      { frequency: 784, duration: 0.8, type: 'sine' as const, volume: 0.1, delay: 250 },
      { frequency: 1047, duration: 0.8, type: 'sine' as const, volume: 0.1, delay: 250 },
    ],
  },
} as const satisfies Record<string, SoundSpec>;

export type SoundName = keyof typeof SOUND_SPECS;

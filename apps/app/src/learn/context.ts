import { createContext } from 'react';
import type { Advice, PlayerView } from '@tysiac/engine';

export interface LessonControl {
  /** Replaces advise() for the viewer's turn; null = no coach line. */
  advice(view: PlayerView): Advice | null;
}

/** Set only by the Learn screen. Game reads it; real rooms never provide it. */
export const LessonContext = createContext<LessonControl | null>(null);

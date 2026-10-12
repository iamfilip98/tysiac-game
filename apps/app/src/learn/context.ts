import { createContext } from 'react';
import type { AdviseOptions, PlayerView } from '@tysiac/engine';
import type { CoachAdvice } from '../i18n/engineText';

export interface LessonControl {
  /** Replaces advise() for the viewer's turn; null = no coach line. */
  advice(view: PlayerView, opts?: AdviseOptions): CoachAdvice | null;
}

/** Set only by the Learn screen. Game reads it; real rooms never provide it. */
export const LessonContext = createContext<LessonControl | null>(null);

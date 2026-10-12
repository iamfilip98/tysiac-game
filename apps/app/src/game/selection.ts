import { create } from 'zustand';
import type { Card, PlayerId } from '@tysiac/engine';

export interface SelectionState {
  /** cardKey of the raised card. */
  selected: string | null;
  /** Hand-out assignments (recipient → card). */
  given: Record<PlayerId, Card>;
  hint: string | null;
  select(key: string | null): void;
  give(p: PlayerId, card: Card): void;
  ungive(p: PlayerId): void;
  setHint(hint: string | null): void;
  reset(): void;
}

export const useSelection = create<SelectionState>()(set => ({
  selected: null,
  given: {},
  hint: null,
  select: key => set({ selected: key }),
  give: (p, card) => set(s => ({ given: { ...s.given, [p]: card }, selected: null })),
  ungive: p =>
    set(s => {
      const given = { ...s.given };
      delete given[p];
      return { given };
    }),
  setHint: hint => set({ hint }),
  reset: () => set({ selected: null, given: {}, hint: null }),
}));

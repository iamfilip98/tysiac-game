import { create } from 'zustand';
import type { Card, PlayerId } from '@tysiac/engine';

export interface SelectionState {
  /** cardKey of the raised card. */
  selected: string | null;
  /** Hand-out assignments (recipient → card). */
  given: Record<PlayerId, Card>;
  hint: string | null;
  /** Hand-out: the recipient whose slot was tapped (the next card tapped goes to them). */
  target: PlayerId | null;
  select(key: string | null): void;
  setTarget(p: PlayerId | null): void;
  give(p: PlayerId, card: Card): void;
  ungive(p: PlayerId): void;
  setHint(hint: string | null): void;
  reset(): void;
}

/** Hand-out: who gets the next tapped card (the tapped slot if still empty, else the first empty slot). */
export function nextRecipient(recipients: readonly PlayerId[], given: Partial<Record<PlayerId, Card>>, target: PlayerId | null): PlayerId | null {
  if (target && recipients.includes(target) && !given[target]) return target;
  return recipients.find(p => !given[p]) ?? null;
}

export const useSelection = create<SelectionState>()(set => ({
  selected: null,
  given: {},
  hint: null,
  target: null,
  select: key => set({ selected: key }),
  setTarget: p => set({ target: p }),
  give: (p, card) => set(s => ({ given: { ...s.given, [p]: card }, selected: null, target: null })),
  ungive: p =>
    set(s => {
      const given = { ...s.given };
      delete given[p];
      return { given };
    }),
  setHint: hint => set({ hint }),
  reset: () => set({ selected: null, given: {}, hint: null, target: null }),
}));

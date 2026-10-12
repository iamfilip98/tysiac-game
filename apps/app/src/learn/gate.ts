import { realClock, type Clock } from '../net/localRoom';

/** Open = timers run when due; closed = due timers wait until the gate opens. */
export class Gate {
  private open = true;
  private readonly waiters = new Set<() => void>();
  isOpen(): boolean {
    return this.open;
  }
  set(open: boolean): void {
    if (open === this.open) return;
    this.open = open;
    if (!open) return;
    const due = [...this.waiters];
    this.waiters.clear();
    for (const fn of due) fn();
  }
  /** Runs fn now if open, else when the gate next opens. Returns a cancel function. */
  whenOpen(fn: () => void): () => void {
    if (this.open) {
      fn();
      return () => {};
    }
    this.waiters.add(fn);
    return () => {
      this.waiters.delete(fn);
    };
  }
}

/** A Clock whose timers hold while `gate` is closed (bots wait while the lesson explains). */
export function gatedClock(gate: Gate, base: Clock = realClock): Clock {
  return {
    now: () => base.now(),
    setTimeout(fn, ms) {
      let cancelWait = () => {};
      const cancelTimer = base.setTimeout(() => {
        cancelWait = gate.whenOpen(fn);
      }, ms);
      return () => {
        cancelTimer();
        cancelWait();
      };
    },
  };
}

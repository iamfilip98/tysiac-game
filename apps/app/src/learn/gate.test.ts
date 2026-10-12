import { describe, expect, it } from 'vitest';
import { Gate, gatedClock } from './gate';
import { FakeClock } from '../test/fakes';

describe('gatedClock', () => {
  it('runs timers normally while the gate is open', () => {
    const base = new FakeClock();
    const clock = gatedClock(new Gate(), base);
    let ran = 0;
    clock.setTimeout(() => ran++, 100);
    base.advance(99);
    expect(ran).toBe(0);
    base.advance(1);
    expect(ran).toBe(1);
  });

  it('a closed gate holds a due timer until it opens', () => {
    const base = new FakeClock();
    const gate = new Gate();
    const clock = gatedClock(gate, base);
    let ran = 0;
    gate.set(false);
    clock.setTimeout(() => ran++, 100);
    base.advance(10_000);
    expect(ran).toBe(0);
    gate.set(true);
    expect(ran).toBe(1);
  });

  it('cancel works before and after the timer is due', () => {
    const base = new FakeClock();
    const gate = new Gate();
    const clock = gatedClock(gate, base);
    let ran = 0;
    const cancelEarly = clock.setTimeout(() => ran++, 100);
    cancelEarly();
    gate.set(false);
    const cancelHeld = clock.setTimeout(() => ran++, 100);
    base.advance(200);
    cancelHeld();
    gate.set(true);
    expect(ran).toBe(0);
  });

  it('now() comes from the base clock', () => {
    const base = new FakeClock();
    expect(gatedClock(new Gate(), base).now()).toBe(base.now());
  });
});

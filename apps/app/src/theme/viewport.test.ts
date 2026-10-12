import { describe, expect, it, vi } from 'vitest';
import { installViewportVar } from './viewport';

describe('installViewportVar', () => {
  it('sets --vvh from visualViewport and follows resizes', () => {
    const listeners: Record<string, () => void> = {};
    const vv = { height: 612.4, addEventListener: (t: string, f: () => void) => { listeners[t] = f; }, removeEventListener: vi.fn() };
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
    const off = installViewportVar(window);
    expect(document.documentElement.style.getPropertyValue('--vvh')).toBe('612px');
    vv.height = 500;
    listeners.resize();
    expect(document.documentElement.style.getPropertyValue('--vvh')).toBe('500px');
    off();
    expect(vv.removeEventListener).toHaveBeenCalled();
  });

  it('falls back to innerHeight without visualViewport', () => {
    Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true });
    const off = installViewportVar(window);
    expect(document.documentElement.style.getPropertyValue('--vvh')).toBe(`${window.innerHeight}px`);
    off();
  });

  it('scrolls back to the top after an input blurs on a non-scrollable page', () => {
    vi.useFakeTimers();
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    Object.defineProperty(window, 'scrollY', { value: 40, configurable: true });
    const off = installViewportVar(window);
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    input.blur();
    vi.advanceTimersByTime(100);
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    off();
    input.remove();
    vi.useRealTimers();
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });
});

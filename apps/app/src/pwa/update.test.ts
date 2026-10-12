import { describe, expect, it, vi } from 'vitest';
import { decideUpdate, installUpdates, showUpdateToast } from './update';

describe('update policy', () => {
  it('applies outside rooms and prompts inside', () => {
    for (const p of ['/', '/history', '/learn', '/settings']) expect(decideUpdate(p)).toBe('apply');
    for (const p of ['/r/ABCD', '/r/ABCD/']) expect(decideUpdate(p)).toBe('prompt');
  });

  it('shows one toast that reloads on tap and respects safe areas', () => {
    const onReload = vi.fn();
    const a = showUpdateToast(document, onReload);
    expect(showUpdateToast(document, onReload)).toBe(a);
    expect(document.querySelectorAll('#update-toast')).toHaveLength(1);
    expect(a.style.cssText).toContain('--sa-top');
    expect(a.style.cssText).not.toContain('bottom');
    a.querySelector<HTMLButtonElement>('button:not([aria-label])')!.click();
    expect(onReload).toHaveBeenCalledOnce();
    a.querySelector<HTMLButtonElement>('[aria-label="Dismiss"]')!.click();
    expect(document.getElementById('update-toast')).toBeNull();
  });

  it('installUpdates reloads silently on home and toasts in a room', () => {
    const update = vi.fn(async () => {});
    let cb = () => {};
    installUpdates(opts => {
      cb = opts.onNeedRefresh;
      return update;
    });
    window.history.pushState({}, '', '/');
    cb();
    expect(update).toHaveBeenCalledWith(true);
    update.mockClear();
    window.history.pushState({}, '', '/r/ABCD');
    cb();
    expect(update).not.toHaveBeenCalled();
    const toast = document.getElementById('update-toast')!;
    toast.querySelector('button')!.click();
    expect(update).toHaveBeenCalledWith(true);
    toast.remove();
    window.history.pushState({}, '', '/');
  });
});

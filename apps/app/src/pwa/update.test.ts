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
    expect(a.style.cssText).toContain('--sa-bottom');
    a.click();
    expect(onReload).toHaveBeenCalledOnce();
    a.remove();
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
    toast.click();
    expect(update).toHaveBeenCalledWith(true);
    toast.remove();
    window.history.pushState({}, '', '/');
  });
});

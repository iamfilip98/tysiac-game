/**
 * Keeps `--vvh` (visual viewport height, px) on <html> as a fallback for browsers without `dvh`,
 * and undoes the scroll offset iOS sometimes leaves after the keyboard closes.
 */
export function installViewportVar(win: Window = window): () => void {
  const root = win.document.documentElement;
  const vv = win.visualViewport ?? null;
  const update = () => {
    const h = vv ? vv.height : win.innerHeight;
    root.style.setProperty('--vvh', `${Math.round(h)}px`);
  };
  const onFocusOut = (e: FocusEvent) => {
    const t = e.target as HTMLElement | null;
    if (!t || !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    win.setTimeout(() => {
      const doc = win.document.documentElement;
      if (doc.scrollHeight <= win.innerHeight + 1 && win.scrollY !== 0) win.scrollTo(0, 0);
    }, 60);
  };
  update();
  vv?.addEventListener('resize', update);
  win.addEventListener('resize', update);
  win.document.addEventListener('focusout', onFocusOut);
  return () => {
    vv?.removeEventListener('resize', update);
    win.removeEventListener('resize', update);
    win.document.removeEventListener('focusout', onFocusOut);
  };
}

/**
 * Keeps `--vvh` (visual viewport height, px) on <html> as a fallback for browsers without `dvh`,
 * and undoes the scroll offset iOS sometimes leaves after the keyboard closes.
 *
 * Also sets `--app-h` for home-screen apps: with a black-translucent status bar iOS reports a
 * viewport (`100dvh`, `100%`, fixed `inset: 0`) that is short by the top safe-area inset, leaving
 * a dead strip above the home bar. A standalone web clip always covers the whole screen, so when
 * the window spans the screen's width we size the app to the screen's height instead.
 */
export function standaloneAppHeight(win: Window): number | null {
  const nav = win.navigator as Navigator & { standalone?: boolean };
  const standalone = nav.standalone === true || win.matchMedia?.('(display-mode: standalone)').matches === true;
  if (!standalone || !win.screen) return null;
  const { width: sw, height: sh } = win.screen;
  const portrait = win.innerHeight >= win.innerWidth;
  const screenW = portrait ? Math.min(sw, sh) : Math.max(sw, sh);
  const screenH = portrait ? Math.max(sw, sh) : Math.min(sw, sh);
  if (Math.abs(win.innerWidth - screenW) > 2) return null; // split view / Stage Manager
  if (screenH < win.innerHeight || screenH - win.innerHeight > 120) return null;
  return screenH;
}

export function installViewportVar(win: Window = window): () => void {
  const root = win.document.documentElement;
  const vv = win.visualViewport ?? null;
  const update = () => {
    const h = vv ? vv.height : win.innerHeight;
    root.style.setProperty('--vvh', `${Math.round(h)}px`);
    const app = standaloneAppHeight(win);
    if (app) root.style.setProperty('--app-h', `${app}px`);
    else root.style.removeProperty('--app-h');
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

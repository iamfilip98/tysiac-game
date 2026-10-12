/** Service-worker update policy: never reload a player out of a room on our own. */

export type UpdateAction = 'apply' | 'prompt';

/** A room (lobby or game) is on screen when the path is /r/<code>. Practice rooms are memory-only. */
export function inRoom(pathname: string): boolean {
  return pathname.startsWith('/r/');
}

export function decideUpdate(pathname: string): UpdateAction {
  return inRoom(pathname) ? 'prompt' : 'apply';
}

export function showUpdateToast(doc: Document, onReload: () => void): HTMLElement {
  const existing = doc.getElementById('update-toast');
  if (existing) return existing;
  const el = doc.createElement('button');
  el.id = 'update-toast';
  el.type = 'button';
  el.textContent = 'Update ready — reload';
  el.setAttribute('role', 'status');
  el.style.cssText = [
    'position:fixed',
    'z-index:1000',
    'left:50%',
    'transform:translateX(-50%)',
    'bottom:max(var(--sa-bottom, 0px), 12px)',
    'margin:0 max(var(--sa-right, 0px), var(--sa-left, 0px))',
    'max-width:calc(100vw - 2 * max(var(--sa-left, 0px), var(--sa-right, 0px), 12px))',
    'padding:10px 16px',
    'border-radius:999px',
    'border:1px solid #d4af6a',
    'background:#0d3528',
    'color:#f8f4ea',
    'font:600 14px/1.2 system-ui,sans-serif',
    'box-shadow:0 4px 16px rgba(0,0,0,.4)',
  ].join(';');
  el.addEventListener('click', onReload);
  doc.body.appendChild(el);
  return el;
}

/** Wire the registration: `register` is vite-plugin-pwa's registerSW. */
export function installUpdates(
  register: (opts: { immediate: boolean; onNeedRefresh: () => void }) => (reload?: boolean) => Promise<void>,
): void {
  const updateSW: { fn: (reload?: boolean) => Promise<void> } = { fn: async () => {} };
  updateSW.fn = register({
    immediate: true,
    onNeedRefresh: () => {
      if (decideUpdate(window.location.pathname) === 'apply') void updateSW.fn(true);
      else showUpdateToast(document, () => void updateSW.fn(true));
    },
  });
}

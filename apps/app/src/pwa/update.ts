/** Service-worker update policy: never reload a player out of a room on our own. */
import { t } from '../i18n';

export type UpdateAction = 'apply' | 'prompt';

/** A room (lobby or game) is on screen when the path is /r/<code>. Practice rooms are rooms too. */
export function inRoom(pathname: string): boolean {
  return pathname.startsWith('/r/');
}

export function decideUpdate(pathname: string): UpdateAction {
  return inRoom(pathname) ? 'prompt' : 'apply';
}

export function showUpdateToast(doc: Document, onReload: () => void): HTMLElement {
  const existing = doc.getElementById('update-toast');
  if (existing) return existing;
  const el = doc.createElement('div');
  el.id = 'update-toast';
  el.setAttribute('role', 'status');
  // Top-centre over the (non-interactive) top-bar title, below the safe area: clear of the hand, opponents and the edge buttons.
  el.style.cssText = [
    'position:fixed',
    'z-index:1000',
    'left:50%',
    'transform:translateX(-50%)',
    'top:calc(var(--sa-top, 0px) + 4px)',
    'display:flex',
    'align-items:center',
    'gap:4px',
    'max-width:min(240px, calc(100vw - 2 * max(var(--sa-left, 0px), var(--sa-right, 0px), 12px)))',
    'padding:2px 4px 2px 10px',
    'border-radius:999px',
    'border:1px solid #d4af6a',
    'background:#0d3528',
    'color:#f8f4ea',
    'font:600 12px/1.2 system-ui,sans-serif',
    'box-shadow:0 4px 16px rgba(0,0,0,.4)',
  ].join(';');
  const btnCss = 'background:none;border:0;color:inherit;font:inherit;padding:6px;cursor:pointer';
  const reload = doc.createElement('button');
  reload.type = 'button';
  reload.textContent = t('screens.update.ready');
  reload.style.cssText = btnCss;
  reload.addEventListener('click', onReload);
  const dismiss = doc.createElement('button');
  dismiss.type = 'button';
  dismiss.textContent = '✕';
  dismiss.setAttribute('aria-label', t('common.dismiss'));
  dismiss.style.cssText = btnCss;
  dismiss.addEventListener('click', () => el.remove());
  el.append(reload, dismiss);
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

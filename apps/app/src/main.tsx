import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './theme/fonts';
import './theme/themes.css';
import './theme/base.css';
import { installViewportVar } from './theme/viewport';
import { App } from './App';
import { isLocalMode } from './net/service';
import { initLang } from './store/prefs';

installViewportVar();
// Latch ?local=1 (sticky for the tab) before any navigation drops the query string.
isLocalMode();

// The saved language (English unless picked in Settings) must be active before the first render.
// (A promise chain, not top-level await: TLA makes Rollup split the entry into many small chunks.)
void initLang().then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);

if (import.meta.env.PROD) {
  void Promise.all([import('virtual:pwa-register'), import('./pwa/update')]).then(([{ registerSW }, { installUpdates }]) =>
    installUpdates(registerSW),
  );
}

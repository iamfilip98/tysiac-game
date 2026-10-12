import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './theme/fonts';
import './theme/themes.css';
import './theme/base.css';
import { installViewportVar } from './theme/viewport';
import { App } from './App';

installViewportVar();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.PROD) {
  void Promise.all([import('virtual:pwa-register'), import('./pwa/update')]).then(([{ registerSW }, { installUpdates }]) =>
    installUpdates(registerSW),
  );
}

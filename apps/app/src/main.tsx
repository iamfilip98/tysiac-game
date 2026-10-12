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
  void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
}

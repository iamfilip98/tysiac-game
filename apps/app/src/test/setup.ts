import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { currentLang, loadLang } from '../i18n';

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

afterEach(async () => {
  cleanup();
  // A test that switched language must not leak it into the next one.
  if (currentLang() !== 'en') await loadLang('en');
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
});

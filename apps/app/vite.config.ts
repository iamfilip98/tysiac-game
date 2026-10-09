import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The hoisted pnpm layout leaves React 18 (apps/web) at the repo root, and @testing-library/react gets its
// own nested React 19. In tests, pin react/react-dom to the exact copies Testing Library loads so the app,
// wouter and react-dom all share one React instance.
const require = createRequire(import.meta.url);
const rtlRequire = createRequire(require.resolve('@testing-library/react'));
const pkgDir = (name: string) => dirname(rtlRequire.resolve(`${name}/package.json`));

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve:
    mode === 'test'
      ? {
          alias: [
            { find: /^use-sync-external-store\/shim(\/index\.js)?$/, replacement: fileURLToPath(new URL('./src/test/uses-shim.ts', import.meta.url)) },
            { find: /^react$/, replacement: pkgDir('react') + '/index.js' },
            { find: /^react\/(.*)$/, replacement: pkgDir('react') + '/$1' },
            { find: /^react-dom$/, replacement: pkgDir('react-dom') + '/index.js' },
            { find: /^react-dom\/(.*)$/, replacement: pkgDir('react-dom') + '/$1' },
          ],
        }
      : {},
  build: { outDir: 'dist', target: 'es2022' },
  preview: { port: 4173, strictPort: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    server: { deps: { inline: [/wouter/, /zustand/] } },
  },
}));

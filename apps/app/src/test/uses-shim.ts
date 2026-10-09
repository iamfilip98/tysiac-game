// React 19 has useSyncExternalStore built in; wouter's `use-sync-external-store/shim` would otherwise load
// a nested React copy in the hoisted install layout. See vite.config.ts.
export { useSyncExternalStore } from 'react';

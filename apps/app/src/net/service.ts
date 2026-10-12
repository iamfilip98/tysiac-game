import type { RoomService } from './connection';
import { safeSessionStorage } from '../store/storage';

const FLAG = 'tysiac.local';

function readFlag(): string | null {
  const store = safeSessionStorage();
  const q = new URLSearchParams(window.location.search);
  const local = q.get('local');
  if (local === '1') store.setItem(FLAG, q.get('fast') === '1' ? 'fast' : '1');
  else if (local === '0') store.removeItem(FLAG);
  return store.getItem(FLAG);
}

/** `?local=1` (sticky for this tab) or VITE_LOCAL=1 → rooms run in the browser (no server). */
export function isLocalMode(): boolean {
  return readFlag() !== null || import.meta.env.VITE_LOCAL === '1';
}

/** `?local=1&fast=1`: bots and animations run ~10–20× faster (e2e). */
export function isFastLocal(): boolean {
  return readFlag() === 'fast';
}

let service: Promise<RoomService> | null = null;
let override: RoomService | null = null;

async function build(): Promise<RoomService> {
  if (isLocalMode()) {
    const m = await import('./localService');
    return m.localService(new m.LocalHub({ botDelayScale: isFastLocal() ? 0.05 : 1 }));
  }
  const m = await import('./httpService');
  return m.httpService();
}

/** The promise is cached so concurrent first calls share one service (and one LocalHub). */
export function getService(): Promise<RoomService> {
  if (override) return Promise.resolve(override);
  if (!service) {
    const p = build();
    service = p;
    p.catch(() => {
      if (service === p) service = null;
    });
  }
  return service;
}

export function setServiceForTests(s: RoomService | null): void {
  override = s;
  service = null;
}

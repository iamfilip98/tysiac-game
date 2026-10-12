import type { RoomService } from './connection';
import { safeSessionStorage } from '../store/storage';

const FLAG = 'tysiac.local';

function readFlag(): string | null {
  const store = safeSessionStorage();
  const q = new URLSearchParams(window.location.search);
  if (q.has('local')) store.setItem(FLAG, q.get('fast') === '1' ? 'fast' : '1');
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

let service: RoomService | null = null;
let override: RoomService | null = null;

export async function getService(): Promise<RoomService> {
  if (override) return override;
  if (service) return service;
  if (isLocalMode()) {
    const m = await import('./localService');
    service = m.localService(new m.LocalHub({ botDelayScale: isFastLocal() ? 0.05 : 1 }));
  } else {
    const m = await import('./httpService');
    service = m.httpService();
  }
  return service;
}

export function setServiceForTests(s: RoomService | null): void {
  override = s;
  service = null;
}

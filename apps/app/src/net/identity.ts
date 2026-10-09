import { safeLocalStorage, type KV } from '../store/storage';

export interface Identity {
  playerId: string;
  secret: string;
}

const KEY = 'tysiac.identity';
const UUID = /^[0-9a-f-]{36}$/;

/** RFC 4122 v4 UUID (122 random bits); randomUUID is missing on insecure origins such as LAN http dev. */
function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** This device's player id and secret (created on first use, kept in localStorage). */
export function getIdentity(store: KV = safeLocalStorage()): Identity {
  try {
    const raw = JSON.parse(store.getItem(KEY) ?? 'null') as Partial<Identity> | null;
    if (raw && typeof raw.playerId === 'string' && UUID.test(raw.playerId) && typeof raw.secret === 'string' && UUID.test(raw.secret)) {
      return { playerId: raw.playerId, secret: raw.secret };
    }
  } catch {
    // fall through and create a new identity
  }
  const id: Identity = { playerId: uuid(), secret: uuid() };
  store.setItem(KEY, JSON.stringify(id));
  return id;
}

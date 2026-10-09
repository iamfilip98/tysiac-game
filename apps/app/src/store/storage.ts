export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function memoryKV(): KV {
  const m = new Map<string, string>();
  return {
    getItem: k => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: k => void m.delete(k),
  };
}

const memLocal = memoryKV();
const memSession = memoryKV();

function probe(get: () => Storage, fallback: KV): KV {
  try {
    const s = get();
    s.setItem('__probe', '1');
    s.removeItem('__probe');
    return s;
  } catch {
    return fallback;
  }
}

/** localStorage, or an in-memory stand-in when storage is blocked (private mode, disabled cookies). */
export function safeLocalStorage(): KV {
  return probe(() => window.localStorage, memLocal);
}

export function safeSessionStorage(): KV {
  return probe(() => window.sessionStorage, memSession);
}

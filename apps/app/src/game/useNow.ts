import { useEffect, useState } from 'react';

/** Server-time "now" (local clock + offset), ticking every second while `active`. */
export function useNow(active: boolean, offset: number): number {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    if (!active) return;
    setNow(Date.now() + offset);
    const t = setInterval(() => setNow(Date.now() + offset), 1000);
    return () => clearInterval(t);
  }, [active, offset]);
  return now;
}

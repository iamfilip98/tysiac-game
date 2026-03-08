import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@tysiac/shared';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

export function getSocket(authToken?: string): TypedSocket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      transports: ['websocket', 'polling'],
      ...(authToken ? { auth: { token: authToken } } : {}),
    }) as TypedSocket;
  }
  return socket;
}

export function reconnectWithAuth(authToken?: string): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  // Next getSocket() call will create a new socket with the auth token
  // Force creation now so listeners can be attached
  socket = io(SOCKET_URL, {
    autoConnect: false,
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    transports: ['websocket', 'polling'],
    ...(authToken ? { auth: { token: authToken } } : {}),
  }) as TypedSocket;
}

export function connectSocket(): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = getSocket();

    if (s.connected) {
      resolve();
      return;
    }

    let settled = false;

    // Allow enough time for initial connection (Render cold start can take 30-60s)
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        s.off('connect', onConnect);
        reject(new Error('Connection timeout'));
      }
    }, 30000);

    function onConnect() {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        resolve();
      }
    }

    // Use .once so the handler auto-removes after firing, preventing listener leaks
    s.once('connect', onConnect);

    s.connect();
  });
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// Keep-alive: ping /health every 5 min to prevent Render free-tier spin-down
let keepAliveInterval: ReturnType<typeof setInterval> | null = null;

export function startKeepAlive(): void {
  if (keepAliveInterval) return;
  keepAliveInterval = setInterval(() => {
    fetch(`${SOCKET_URL}/health`).catch(() => {});
  }, 5 * 60 * 1000);
}

export function stopKeepAlive(): void {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

// Detect tab becoming visible again and reconnect if needed.
// Browsers silently kill WebSocket connections when tabs are backgrounded,
// but socket.io may not detect this — socket.connected stays true on a
// dead connection. We track when the tab was hidden and force a fresh
// disconnect/reconnect if it was backgrounded for more than 5 seconds.
let visibilityHandlerActive = false;
let hiddenAt = 0;

export function startVisibilityHandler(): void {
  if (visibilityHandlerActive || typeof document === 'undefined') return;
  visibilityHandlerActive = true;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      return;
    }

    if (document.visibilityState === 'visible' && socket) {
      const backgroundDuration = Date.now() - hiddenAt;

      if (!socket.connected) {
        console.log('[Socket] Tab became visible, reconnecting...');
        socket.connect();
      } else if (backgroundDuration > 30000) {
        // Socket claims connected but was backgrounded long enough for the
        // browser to have killed the transport. Force a fresh connection.
        console.log(`[Socket] Tab was backgrounded for ${Math.round(backgroundDuration / 1000)}s, forcing reconnect...`);
        socket.disconnect().connect();
      }
    }
  });
}

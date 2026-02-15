import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@tysiac/shared';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

export function getSocket(): TypedSocket {
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
    }) as TypedSocket;
  }
  return socket;
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

// Detect tab becoming visible again and reconnect if needed
// Browsers can silently kill WebSocket connections when tab is backgrounded
let visibilityHandlerActive = false;

export function startVisibilityHandler(): void {
  if (visibilityHandlerActive || typeof document === 'undefined') return;
  visibilityHandlerActive = true;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && socket && !socket.connected) {
      console.log('[Socket] Tab became visible, reconnecting...');
      socket.connect();
    }
  });
}

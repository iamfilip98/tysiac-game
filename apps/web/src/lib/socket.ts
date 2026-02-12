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
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
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

    // Allow enough time for all reconnection attempts to complete
    // (5 attempts with exponential backoff can take ~17s)
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        s.off('connect', onConnect);
        reject(new Error('Connection timeout'));
      }
    }, 20000);

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

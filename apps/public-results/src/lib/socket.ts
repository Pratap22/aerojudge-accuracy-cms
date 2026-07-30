import { io, type Socket } from 'socket.io-client';
import type { SocketEvents } from '@npha/shared';

type EventMap = SocketEvents;

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      path: '/socket.io',
      autoConnect: false,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function connectPublicSocket(slug: string): Socket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  s.emit('join:public', slug);
  return s;
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}

export function onSocketEvent<K extends keyof EventMap>(
  event: K,
  handler: (payload: EventMap[K]) => void,
): () => void {
  const s = getSocket();
  s.on(event as string, handler as (...args: unknown[]) => void);
  return () => s.off(event as string, handler as (...args: unknown[]) => void);
}

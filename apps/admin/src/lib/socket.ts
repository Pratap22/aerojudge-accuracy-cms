import { io, type Socket } from 'socket.io-client';
import type { SocketEvents } from '@npha/shared';
import { getAccessToken } from './api';

type EventMap = SocketEvents;

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      path: '/socket.io',
      autoConnect: false,
      auth: () => ({ token: getAccessToken() }),
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function connectSocket(competitionId?: string): Socket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  if (competitionId) {
    s.emit('join', { room: `competition:${competitionId}` });
  }
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

export function emitSocketEvent(event: string, payload: unknown): void {
  getSocket().emit(event, payload);
}

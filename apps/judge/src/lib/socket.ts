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

export function connectSocket(competitionId: string, roundId?: string): Socket {
  const s = getSocket();
  if (!s.connected) s.connect();
  s.emit('join', { room: `competition:${competitionId}` });
  if (roundId) s.emit('join', { room: `round:${roundId}` });
  return s;
}

export function disconnectSocket(): void {
  socket?.disconnect();
}

export function onSocketEvent<K extends keyof EventMap>(
  event: K,
  handler: (payload: EventMap[K]) => void,
): () => void {
  const s = getSocket();
  s.on(event as string, handler as (...args: unknown[]) => void);
  return () => s.off(event as string, handler as (...args: unknown[]) => void);
}

import { io, type Socket } from 'socket.io-client';
import type { SocketEvents } from '@npha/shared';

type EventMap = SocketEvents;

let socket: Socket | null = null;
let joinedCompetitionId: string | null = null;
let reconnectHandlerBound = false;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      path: '/socket.io',
      autoConnect: false,
      transports: ['websocket', 'polling'],
      // Recover quickly after brief network blips on venue wifi
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
    });
  }
  return socket;
}

function joinRooms(s: Socket, competitionId: string): void {
  s.emit('join:display', competitionId);
  s.emit('join:competition', competitionId);
}

export function connectDisplaySocket(competitionId: string): Socket {
  const s = getSocket();
  joinedCompetitionId = competitionId;

  if (!reconnectHandlerBound) {
    s.on('connect', () => {
      if (joinedCompetitionId) {
        joinRooms(s, joinedCompetitionId);
      }
    });
    reconnectHandlerBound = true;
  }

  if (!s.connected) {
    s.connect();
  } else {
    joinRooms(s, competitionId);
  }
  return s;
}

/** Leave rooms without tearing down the singleton (other hooks may still use it). */
export function leaveDisplayRooms(competitionId?: string): void {
  const id = competitionId ?? joinedCompetitionId;
  if (!id || !socket) return;
  socket.emit('leave:competition', id);
  socket.emit('leave:display', id);
  if (joinedCompetitionId === id) {
    joinedCompetitionId = null;
  }
}

export function disconnectSocket(): void {
  joinedCompetitionId = null;
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

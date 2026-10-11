import { io, type Socket } from 'socket.io-client';
import type { SocketEvents } from '@aero-judge/shared';
import { apiBaseUrl } from './api';

type EventMap = SocketEvents;

const LIVE_CHECK_MS = 60_000;
const LIVE_CHECK_TIMEOUT_MS = 8_000;

let socket: Socket | null = null;
let joinedCompetitionId: string | null = null;
let closedByUser = false;
let watchBound = false;
let probeInFlight = false;
let hasConnected = false;

const recoverHandlers = new Set<() => void>();

function getSocket(): Socket {
  if (!socket) {
    socket = io(apiBaseUrl(), {
      path: '/socket.io',
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
    });
  }
  return socket;
}

function rejoin(): void {
  if (!socket || !joinedCompetitionId || closedByUser) return;
  socket.emit('join:public', joinedCompetitionId);
}

function bindLiveWatch(s: Socket): void {
  if (watchBound) return;
  watchBound = true;

  s.on('connect', () => {
    if (closedByUser) return;
    rejoin();
    if (hasConnected) {
      recoverHandlers.forEach((handler) => handler());
    }
    hasConnected = true;
  });

  s.on('disconnect', (reason) => {
    if (closedByUser || reason === 'io client disconnect') return;
    if (!s.active) s.connect();
  });

  setInterval(() => {
    if (closedByUser || probeInFlight || !socket) return;
    if (!s.connected) {
      s.connect();
      return;
    }
    probeInFlight = true;
    s.timeout(LIVE_CHECK_TIMEOUT_MS).emit('connection:check', (err: Error | null) => {
      probeInFlight = false;
      if (closedByUser || !err) return;
      s.disconnect();
      if (!closedByUser) s.connect();
    });
  }, LIVE_CHECK_MS);
}

/** Join the public room for one competition. The room id is the competition id. */
export function connectPublicSocket(competitionId: string): Socket {
  const s = getSocket();
  closedByUser = false;
  joinedCompetitionId = competitionId;
  bindLiveWatch(s);
  if (!s.connected) s.connect();
  else rejoin();
  return s;
}

/** Fired after the socket returns, so the screen can reload anything missed while disconnected. */
export function onSocketReconnect(handler: () => void): () => void {
  recoverHandlers.add(handler);
  return () => recoverHandlers.delete(handler);
}

export function disconnectSocket(): void {
  closedByUser = true;
  joinedCompetitionId = null;
  hasConnected = false;
  if (socket?.connected) socket.disconnect();
}

export function onSocketEvent<K extends keyof EventMap>(
  event: K,
  handler: (payload: EventMap[K]) => void,
): () => void {
  const s = getSocket();
  s.on(event as string, handler as (...args: unknown[]) => void);
  return () => s.off(event as string, handler as (...args: unknown[]) => void);
}

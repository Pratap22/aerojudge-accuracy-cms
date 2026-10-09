import { io, type Socket } from 'socket.io-client';
import type { SocketEvents } from '@aero-judge/shared';

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

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
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

function joinRooms(s: Socket, competitionId: string): void {
  s.emit('join:display', competitionId);
  s.emit('join:competition', competitionId);
}

function rejoin(): void {
  if (!socket || !joinedCompetitionId || closedByUser) return;
  joinRooms(socket, joinedCompetitionId);
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

  window.setInterval(() => {
    if (closedByUser || probeInFlight) return;
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

export function connectDisplaySocket(competitionId: string): Socket {
  const s = getSocket();
  closedByUser = false;
  joinedCompetitionId = competitionId;
  bindLiveWatch(s);
  if (!s.connected) s.connect();
  else rejoin();
  return s;
}

/** Fired after the socket comes back from a drop, so live pages can reload missed updates. */
export function onSocketReconnect(handler: () => void): () => void {
  recoverHandlers.add(handler);
  return () => recoverHandlers.delete(handler);
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
  closedByUser = true;
  joinedCompetitionId = null;
  hasConnected = false;
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

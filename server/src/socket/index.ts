import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { SOCKET_ROOMS, type RankingCategory, type RoundStatus } from '@npha/shared';
import { env } from '../config/env.js';
import { verifyAccessToken } from '../auth/jwt.js';

let io: Server | null = null;

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: env.corsOrigins,
      credentials: true,
    },
    path: '/socket.io',
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      next();
      return;
    }
    try {
      const payload = verifyAccessToken(token);
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('join:competition', (competitionId: string) => {
      socket.join(SOCKET_ROOMS.competition(competitionId));
    });

    socket.on('join:round', (roundId: string) => {
      socket.join(SOCKET_ROOMS.round(roundId));
    });

    socket.on('join:display', (competitionId: string) => {
      socket.join(SOCKET_ROOMS.display(competitionId));
    });

    socket.on('join:public', (slug: string) => {
      socket.join(SOCKET_ROOMS.public(slug));
    });

    socket.on('leave:competition', (competitionId: string) => {
      socket.leave(SOCKET_ROOMS.competition(competitionId));
    });
  });

  return io;
}

export function getIo(): Server {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

export function emitScoreUpdated(
  competitionId: string,
  roundId: string,
  score: unknown,
  pilot?: {
    id: string;
    pilotNumber: number;
    firstName: string;
    lastName: string;
    country?: string;
    countryCode?: string;
  },
): void {
  getIo()
    .to(SOCKET_ROOMS.competition(competitionId))
    .to(SOCKET_ROOMS.round(roundId))
    .to(SOCKET_ROOMS.display(competitionId))
    .emit('score:updated', { competitionId, roundId, score, pilot });
}

export function emitRoundStatus(
  competitionId: string,
  roundId: string,
  status: RoundStatus,
  number?: number,
): void {
  getIo()
    .to(SOCKET_ROOMS.competition(competitionId))
    .to(SOCKET_ROOMS.round(roundId))
    .to(SOCKET_ROOMS.display(competitionId))
    .emit('round:status', { competitionId, roundId, status, number });
}

export function emitRankingUpdated(competitionId: string, category: RankingCategory): void {
  getIo()
    .to(SOCKET_ROOMS.competition(competitionId))
    .to(SOCKET_ROOMS.public(competitionId))
    .emit('ranking:updated', { competitionId, category });
}

export function emitFlightStatus(
  competitionId: string,
  flightId: string,
  status: string,
): void {
  getIo()
    .to(SOCKET_ROOMS.competition(competitionId))
    .emit('flight:status', { competitionId, flightId, status });
}

export function emitAnnouncement(
  competitionId: string,
  announcement: { title: string; body: string; priority: string },
): void {
  getIo()
    .to(SOCKET_ROOMS.competition(competitionId))
    .emit('announcement:new', { competitionId, ...announcement });
}

export function emitWindUpdated(
  competitionId: string,
  wind: { directionDeg: number; speedMs: number },
): void {
  getIo()
    .to(SOCKET_ROOMS.competition(competitionId))
    .to(SOCKET_ROOMS.display(competitionId))
    .emit('wind:updated', { competitionId, ...wind });
}

export function emitDisplayLayout(
  competitionId: string,
  layoutType: string,
  payload: unknown,
): void {
  getIo()
    .to(SOCKET_ROOMS.display(competitionId))
    .emit('display:layout', { competitionId, layoutType, payload });
}

export function emitResultsPublished(
  competitionId: string,
  roundId: string,
  category: string,
): void {
  getIo()
    .to(SOCKET_ROOMS.competition(competitionId))
    .to(SOCKET_ROOMS.public(competitionId))
    .emit('results:published', { competitionId, roundId, category });
}

export function emitSyncRequired(competitionId: string): void {
  getIo().to(SOCKET_ROOMS.competition(competitionId)).emit('sync:required', { competitionId });
}

export function emitCurrentPilot(
  competitionId: string,
  pilotId: string | null,
  flightId: string | null,
): void {
  getIo()
    .to(SOCKET_ROOMS.competition(competitionId))
    .to(SOCKET_ROOMS.display(competitionId))
    .emit('pilot:current', { competitionId, pilotId, flightId });
}

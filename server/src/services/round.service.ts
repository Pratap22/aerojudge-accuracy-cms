import { shuffleArray } from '@npha/utils';
import type { FlightOrderType, RoundStatus } from '@npha/shared';
import type { Prisma } from '@npha/database';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { getCompetition } from './competition.service.js';

const ACTIVE_STATUSES: RoundStatus[] = ['OPEN', 'ACTIVE', 'PAUSED'];

export async function listRounds(competitionId: string) {
  await getCompetition(competitionId);
  return prisma.round.findMany({
    where: { competitionId },
    orderBy: { number: 'asc' },
    include: { _count: { select: { flights: true, scores: true } } },
  });
}

export async function getRound(competitionId: string, roundId: string) {
  const round = await prisma.round.findFirst({
    where: { id: roundId, competitionId },
    include: {
      flights: {
        orderBy: { flightOrder: 'asc' },
        include: {
          pilot: { include: { country: true } },
          scores: {
            orderBy: { updatedAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  });
  if (!round) throw AppError.notFound('Round not found');
  return round;
}

export async function createRound(
  competitionId: string,
  data: {
    number: number;
    name?: string;
    type?: string;
    orderType?: FlightOrderType;
    scheduledAt?: Date;
  },
) {
  const competition = await getCompetition(competitionId);
  const existingCount = await prisma.round.count({ where: { competitionId } });
  if (existingCount >= competition.maxRounds) {
    throw AppError.badRequest(
      `Cannot create more than ${competition.maxRounds} rounds (Max Rounds setting)`,
    );
  }

  const conflict = await prisma.round.findFirst({
    where: { competitionId, number: data.number, type: (data.type ?? 'OFFICIAL') as never },
  });
  if (conflict) {
    throw AppError.conflict(`Round ${data.number} already exists`);
  }

  return prisma.round.create({
    data: {
      competitionId,
      number: data.number,
      name: data.name,
      type: (data.type ?? 'OFFICIAL') as Prisma.RoundCreateInput['type'],
      orderType: data.orderType ?? 'RANDOM',
      scheduledAt: data.scheduledAt,
    },
  });
}

export async function updateRound(
  competitionId: string,
  roundId: string,
  data: Prisma.RoundUpdateInput,
) {
  await getRound(competitionId, roundId);
  return prisma.round.update({ where: { id: roundId }, data });
}

export async function deleteRound(competitionId: string, roundId: string): Promise<void> {
  const round = await getRound(competitionId, roundId);
  if (ACTIVE_STATUSES.includes(round.status as RoundStatus) || round.status === 'CLOSED') {
    throw AppError.badRequest('Cannot delete an active or closed round');
  }
  await prisma.round.delete({ where: { id: roundId } });
}

export async function startRound(competitionId: string, roundId: string) {
  const round = await getRound(competitionId, roundId);
  if (!['SCHEDULED', 'BRIEFING', 'OPEN', 'PAUSED'].includes(round.status)) {
    throw AppError.badRequest(`Cannot start round in status ${round.status}`);
  }

  const flightCount = await prisma.flight.count({ where: { roundId } });
  if (flightCount === 0) {
    await generateFlightOrder(competitionId, roundId, round.orderType as FlightOrderType);
  }

  return prisma.round.update({
    where: { id: roundId },
    data: {
      status: 'ACTIVE',
      startedAt: round.startedAt ?? new Date(),
      pausedAt: null,
    },
    include: { flights: { orderBy: { flightOrder: 'asc' }, include: { pilot: true } } },
  });
}

export async function pauseRound(competitionId: string, roundId: string) {
  const round = await getRound(competitionId, roundId);
  if (round.status !== 'ACTIVE') throw AppError.badRequest('Round is not active');

  return prisma.round.update({
    where: { id: roundId },
    data: { status: 'PAUSED', pausedAt: new Date() },
  });
}

export async function resumeRound(competitionId: string, roundId: string) {
  const round = await getRound(competitionId, roundId);
  if (round.status !== 'PAUSED') throw AppError.badRequest('Round is not paused');

  return prisma.round.update({
    where: { id: roundId },
    data: { status: 'ACTIVE', pausedAt: null },
  });
}

export async function closeRound(competitionId: string, roundId: string) {
  const round = await getRound(competitionId, roundId);
  if (!['ACTIVE', 'PAUSED', 'OPEN'].includes(round.status)) {
    throw AppError.badRequest(`Cannot close round in status ${round.status}`);
  }

  return prisma.round.update({
    where: { id: roundId },
    data: { status: 'CLOSED', closedAt: new Date() },
  });
}

export async function reopenRound(competitionId: string, roundId: string) {
  const round = await getRound(competitionId, roundId);
  if (!['CLOSED', 'PENDING_APPROVAL'].includes(round.status)) {
    throw AppError.badRequest(`Cannot reopen round in status ${round.status}`);
  }

  return prisma.round.update({
    where: { id: roundId },
    data: { status: 'ACTIVE', closedAt: null, approvedAt: null },
  });
}

export async function generateFlightOrder(
  competitionId: string,
  roundId: string,
  orderType: FlightOrderType,
  options?: { seed?: number; manualOrder?: string[] },
) {
  await getRound(competitionId, roundId);

  const pilots = await prisma.pilot.findMany({
    where: {
      competitionId,
      status: { in: ['REGISTERED', 'CONFIRMED', 'CHECKED_IN', 'ACTIVE'] },
    },
    orderBy: { pilotNumber: 'asc' },
  });

  if (pilots.length === 0) throw AppError.badRequest('No eligible pilots for flight order');

  let orderedPilotIds: string[];

  switch (orderType) {
    case 'SEEDED': {
      const previousRound = await prisma.round.findFirst({
        where: { competitionId, number: { lt: (await prisma.round.findUnique({ where: { id: roundId } }))!.number } },
        orderBy: { number: 'desc' },
        include: { flights: { orderBy: { flightOrder: 'asc' } } },
      });
      if (previousRound?.flights.length) {
        orderedPilotIds = previousRound.flights.map((f) => f.pilotId);
        const missing = pilots.filter((p) => !orderedPilotIds.includes(p.id)).map((p) => p.id);
        orderedPilotIds = [...orderedPilotIds, ...missing];
      } else {
        orderedPilotIds = pilots.map((p) => p.id);
      }
      break;
    }
    case 'REVERSE': {
      orderedPilotIds = [...pilots].reverse().map((p) => p.id);
      break;
    }
    case 'MANUAL': {
      if (!options?.manualOrder?.length) {
        throw AppError.badRequest('manualOrder required for MANUAL flight order');
      }
      orderedPilotIds = options.manualOrder;
      break;
    }
    case 'RANDOM':
    default: {
      orderedPilotIds = shuffleArray(
        pilots.map((p) => p.id),
        options?.seed,
      );
      break;
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.flight.deleteMany({ where: { roundId } });
    await tx.flight.createMany({
      data: orderedPilotIds.map((pilotId, index) => ({
        roundId,
        pilotId,
        flightOrder: index + 1,
        status: 'PENDING',
      })),
    });
    await tx.round.update({
      where: { id: roundId },
      data: { orderType },
    });
  });

  return getRound(competitionId, roundId);
}

export async function listFlights(competitionId: string, roundId: string) {
  let round = await getRound(competitionId, roundId);

  // Ensure newly registered pilots appear in the flight order
  const eligiblePilots = await prisma.pilot.findMany({
    where: {
      competitionId,
      status: { in: ['REGISTERED', 'CONFIRMED', 'CHECKED_IN', 'ACTIVE'] },
    },
    orderBy: { pilotNumber: 'asc' },
  });
  const existing = new Set(round.flights.map((f) => f.pilotId));
  const missing = eligiblePilots.filter((p) => !existing.has(p.id));
  if (missing.length > 0) {
    const maxOrder = round.flights.reduce((m, f) => Math.max(m, f.flightOrder), 0);
    await prisma.flight.createMany({
      data: missing.map((p, i) => ({
        roundId,
        pilotId: p.id,
        flightOrder: maxOrder + i + 1,
        status: 'PENDING' as const,
      })),
    });
    round = await getRound(competitionId, roundId);
  }

  return round.flights.map((flight) => {
    const score = flight.scores[0];

    return {
      id: flight.id,
      order: flight.flightOrder,
      flightOrder: flight.flightOrder,
      pilotId: flight.pilotId,
      pilotNumber: flight.pilot.pilotNumber,
      pilotName: `${flight.pilot.firstName} ${flight.pilot.lastName}`,
      country: flight.pilot.country?.name ?? flight.pilot.nationality ?? '—',
      status: flight.status,
      distanceCm: score?.distanceCm ?? null,
      resultType: score?.resultType ?? null,
      finalScoreCm: score?.finalScoreCm ?? null,
    };
  });
}

export async function setManualFlightOrder(
  competitionId: string,
  roundId: string,
  pilotIds: string[],
) {
  return generateFlightOrder(competitionId, roundId, 'MANUAL', { manualOrder: pilotIds });
}


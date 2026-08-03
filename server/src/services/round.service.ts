import { shuffleArray } from '@npha/utils';
import { COMPETING_PILOT_STATUSES, type FlightOrderType, type RoundStatus } from '@npha/shared';
import type { Prisma } from '@npha/database';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import {
  advanceCompetitionForRoundStart,
  getCompetition,
} from './competition.service.js';

const ACTIVE_STATUSES: RoundStatus[] = ['OPEN', 'ACTIVE', 'PAUSED'];

/** Previous round must reach one of these before the next can be created. */
const COMPLETED_FOR_NEXT_ROUND: RoundStatus[] = [
  'CLOSED',
  'PENDING_APPROVAL',
  'APPROVED',
  'LOCKED',
  'CANCELLED',
];

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
  const existingOfficialCount = await prisma.round.count({
    where: { competitionId, type: 'OFFICIAL' },
  });
  const creatingOfficial = (data.type ?? 'OFFICIAL') === 'OFFICIAL';
  if (creatingOfficial && existingOfficialCount >= competition.maxRounds) {
    throw AppError.badRequest(
      `Cannot create more than ${competition.maxRounds} official rounds (Max Rounds setting). Practice rounds do not count.`,
    );
  }

  const previousRound = await prisma.round.findFirst({
    where: { competitionId },
    orderBy: [{ number: 'desc' }, { createdAt: 'desc' }],
  });
  if (previousRound && !COMPLETED_FOR_NEXT_ROUND.includes(previousRound.status as RoundStatus)) {
    throw AppError.badRequest(
      `Cannot create the next round until Round ${previousRound.number} is completed (close, approve, or cancel it first). Current status: ${previousRound.status}`,
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
  data: { type: 'PRACTICE' | 'OFFICIAL' | 'REFLIGHT' | 'RESTART' },
) {
  const round = await getRound(competitionId, roundId);

  if (data.type === round.type) {
    return prisma.round.findFirstOrThrow({ where: { id: roundId } });
  }

  if (round.status === 'LOCKED') {
    throw AppError.badRequest('Round is locked — type cannot be changed');
  }

  if (['APPROVED'].includes(round.status)) {
    throw AppError.badRequest('Cannot change type of an approved round — reopen first if needed');
  }

  if (data.type === 'OFFICIAL' && round.type !== 'OFFICIAL') {
    const competition = await getCompetition(competitionId);
    const officialCount = await prisma.round.count({
      where: { competitionId, type: 'OFFICIAL' },
    });
    if (officialCount >= competition.maxRounds) {
      throw AppError.badRequest(
        `Cannot promote to official — already at max ${competition.maxRounds} official rounds`,
      );
    }
  }

  const conflict = await prisma.round.findFirst({
    where: {
      competitionId,
      number: round.number,
      type: data.type,
      NOT: { id: roundId },
    },
  });
  if (conflict) {
    throw AppError.conflict(
      `Round ${round.number} already exists as ${data.type}. Change that round first.`,
    );
  }

  return prisma.round.update({
    where: { id: roundId },
    data: { type: data.type },
  });
}

export async function deleteRound(competitionId: string, roundId: string): Promise<void> {
  const round = await getRound(competitionId, roundId);
  if (['LOCKED', 'APPROVED'].includes(round.status)) {
    throw AppError.badRequest(`Cannot delete a ${round.status.toLowerCase()} round`);
  }
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

  const updated = await prisma.round.update({
    where: { id: roundId },
    data: {
      status: 'ACTIVE',
      startedAt: round.startedAt ?? new Date(),
      pausedAt: null,
    },
    include: { flights: { orderBy: { flightOrder: 'asc' }, include: { pilot: true } } },
  });

  await advanceCompetitionForRoundStart(competitionId, updated.type);
  return updated;
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
  if (round.status === 'LOCKED') {
    throw AppError.badRequest('Round is locked — no further changes are allowed');
  }
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
  if (round.status === 'LOCKED') {
    throw AppError.badRequest('Round is locked — no further changes are allowed');
  }
  if (!['CLOSED', 'PENDING_APPROVAL', 'APPROVED'].includes(round.status)) {
    throw AppError.badRequest(`Cannot reopen round in status ${round.status}`);
  }

  return prisma.round.update({
    where: { id: roundId },
    data: { status: 'ACTIVE', closedAt: null, approvedAt: null, lockedAt: null },
  });
}

/** Official approval of a closed round — scores become APPROVED; reopen still possible until locked */
export async function approveRound(competitionId: string, roundId: string) {
  const round = await getRound(competitionId, roundId);
  if (round.status === 'LOCKED') {
    throw AppError.badRequest('Round is locked — no further changes are allowed');
  }
  if (!['CLOSED', 'PENDING_APPROVAL'].includes(round.status)) {
    throw AppError.badRequest(`Cannot approve round in status ${round.status}`);
  }

  await prisma.score.updateMany({
    where: { roundId, status: { in: ['ENTERED', 'CONFIRMED', 'DISPUTED'] } },
    data: { status: 'APPROVED' },
  });

  return prisma.round.update({
    where: { id: roundId },
    data: { status: 'APPROVED', approvedAt: new Date() },
  });
}

/**
 * Final lock — only after APPROVED.
 * Locked rounds are immutable: no score edits, type changes, reopen, or unlock.
 */
export async function lockRound(competitionId: string, roundId: string) {
  const round = await getRound(competitionId, roundId);
  if (round.status === 'LOCKED') {
    throw AppError.badRequest('Round is already locked');
  }
  if (round.status !== 'APPROVED') {
    throw AppError.badRequest('Round must be approved before locking');
  }

  await prisma.score.updateMany({
    where: { roundId },
    data: { status: 'LOCKED' },
  });

  return prisma.round.update({
    where: { id: roundId },
    data: { status: 'LOCKED', lockedAt: new Date() },
  });
}

export async function generateFlightOrder(
  competitionId: string,
  roundId: string,
  orderType: FlightOrderType,
  options?: { seed?: number; manualOrder?: string[] },
) {
  const round = await getRound(competitionId, roundId);
  if (['LOCKED', 'APPROVED'].includes(round.status)) {
    throw AppError.badRequest(
      `Cannot change flight order while round is ${round.status}. Reopen first if the round is only approved.`,
    );
  }

  const pilots = await prisma.pilot.findMany({
    where: {
      competitionId,
      status: { in: [...COMPETING_PILOT_STATUSES] },
    },
    orderBy: { pilotNumber: 'asc' },
  });

  if (pilots.length === 0) {
    throw AppError.badRequest(
      'No eligible pilots for flight order. Accept (confirm) registrations first.',
    );
  }

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
      status: { in: [...COMPETING_PILOT_STATUSES] },
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


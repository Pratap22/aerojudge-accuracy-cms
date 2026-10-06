import { ScoringEngine } from '@aero-judge/scoring-engine';
import type { ComputedScore, RoundScoreEntry, ScoreResultType } from '@aero-judge/shared';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { getCompetition, settingsToRuleOverrides } from './competition.service.js';
import { publishEnteredScore } from './event-feed.service.js';

export async function enterScore(
  flightId: string,
  data: {
    distanceCm: number | null;
    resultType: ScoreResultType;
    penaltyCm?: number;
    judgeNotes?: string;
    enteredById: string;
  },
) {
  const flight = await prisma.flight.findUnique({
    where: { id: flightId },
    include: { round: true, pilot: true },
  });
  if (!flight) throw AppError.notFound('Flight not found');

  const judgeNotes = data.judgeNotes?.trim() || undefined;
  if (data.resultType === 'REFLIGHT' && !judgeNotes) {
    throw AppError.badRequest('A reflight reason is required');
  }
  if (judgeNotes && judgeNotes.length > 1000) {
    throw AppError.badRequest('Reason must be 1000 characters or fewer');
  }

  if (['LOCKED', 'APPROVED'].includes(flight.round.status)) {
    throw AppError.badRequest(
      flight.round.status === 'LOCKED'
        ? 'Round is locked — scores are final and cannot be changed'
        : 'Round is approved — reopen before changing scores',
    );
  }
  // Allow CLOSED rounds until official approval/lock so corrections remain possible
  if (
    !['SCHEDULED', 'BRIEFING', 'OPEN', 'ACTIVE', 'PAUSED', 'CLOSED', 'PENDING_APPROVAL'].includes(
      flight.round.status,
    )
  ) {
    throw AppError.badRequest(`Cannot enter scores while round is ${flight.round.status}`);
  }

  const competition = await getCompetition(flight.round.competitionId);
  const rules = ScoringEngine.resolveRules(
    competition.ruleSet,
    settingsToRuleOverrides(competition.settings ?? undefined),
  );

  const computed = ScoringEngine.computeFlightScore(
    {
      pilotId: flight.pilotId,
      roundId: flight.roundId,
      distanceCm: data.distanceCm,
      resultType: data.resultType,
      penaltyCm: data.penaltyCm,
      isReflight: flight.isReflight,
    },
    rules,
  );

  const score = await prisma.score.upsert({
    where: { flightId },
    create: {
      flightId,
      roundId: flight.roundId,
      pilotId: flight.pilotId,
      distanceCm: data.distanceCm,
      resultType: data.resultType,
      penaltyCm: data.penaltyCm ?? 0,
      finalScoreCm: computed.finalScoreCm,
      isBullseye: computed.isBullseye,
      status: 'ENTERED',
      judgeNotes,
      enteredById: data.enteredById,
      enteredAt: new Date(),
    },
    update: {
      distanceCm: data.distanceCm,
      resultType: data.resultType,
      penaltyCm: data.penaltyCm ?? 0,
      finalScoreCm: computed.finalScoreCm,
      isBullseye: computed.isBullseye,
      status: 'ENTERED',
      judgeNotes,
      enteredById: data.enteredById,
      enteredAt: new Date(),
      version: { increment: 1 },
    },
    include: { pilot: true, flight: true },
  });

  await prisma.flight.update({
    where: { id: flightId },
    data: { status: computed.isCountable ? 'SCORED' : 'REFLIGHT' },
  });

  try {
    await publishEnteredScore({
      competitionId: flight.round.competitionId,
      flightId,
      roundNumber: flight.round.number,
      pilotId: flight.pilotId,
      createdById: data.enteredById,
      resultType: data.resultType,
      finalScoreCm: computed.finalScoreCm,
      isBullseye: computed.isBullseye,
      judgeNotes,
    });
  } catch (error) {
    console.error('Failed to publish score to the event feed', error);
  }

  return {
    score,
    computed,
    competitionId: flight.round.competitionId,
    roundId: flight.roundId,
    roundNumber: flight.round.number,
  };
}

export async function confirmScore(scoreId: string, confirmedById: string) {
  const score = await prisma.score.findUnique({
    where: { id: scoreId },
    include: { round: true },
  });
  if (!score) throw AppError.notFound('Score not found');
  if (score.round.status === 'LOCKED') {
    throw AppError.badRequest('Round is locked — scores cannot be changed');
  }
  if (score.round.status === 'APPROVED') {
    throw AppError.badRequest('Round is approved — reopen before changing scores');
  }
  if (score.status !== 'ENTERED' && score.status !== 'DISPUTED') {
    throw AppError.badRequest(`Cannot confirm score in status ${score.status}`);
  }

  return prisma.score.update({
    where: { id: scoreId },
    data: {
      status: 'CONFIRMED',
      confirmedAt: new Date(),
      enteredById: confirmedById,
    },
    include: { pilot: true, flight: true, round: true },
  });
}

export async function listScoresByRound(competitionId: string, roundId: string) {
  const round = await prisma.round.findFirst({ where: { id: roundId, competitionId } });
  if (!round) throw AppError.notFound('Round not found');

  return prisma.score.findMany({
    where: { roundId },
    include: {
      pilot: { include: { country: true } },
      flight: true,
      enteredBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ finalScoreCm: 'asc' }],
  });
}

export async function getScore(scoreId: string) {
  const score = await prisma.score.findUnique({
    where: { id: scoreId },
    include: { pilot: true, flight: true, round: true },
  });
  if (!score) throw AppError.notFound('Score not found');
  return score;
}

export function toComputedScore(score: {
  pilotId: string;
  roundId: string;
  distanceCm: number | null;
  resultType: ScoreResultType;
  penaltyCm: number;
  finalScoreCm: number | null;
  isBullseye: boolean;
}): ComputedScore {
  return {
    pilotId: score.pilotId,
    roundId: score.roundId,
    distanceCm: score.distanceCm,
    resultType: score.resultType,
    penaltyCm: score.penaltyCm,
    finalScoreCm: score.finalScoreCm ?? 0,
    isBullseye: score.isBullseye,
    isCountable: score.resultType !== 'REFLIGHT',
    notes: [],
  };
}

export async function buildRoundScoreEntries(competitionId: string): Promise<{
  pilots: Array<{
    pilotId: string;
    pilotNumber: number;
    gender?: string;
    isJunior?: boolean;
    isWomen?: boolean;
    countryId?: string | null;
    status?: string;
    roundScores: RoundScoreEntry[];
  }>;
  rules: ReturnType<typeof ScoringEngine.resolveRules>;
}> {
  const competition = await getCompetition(competitionId);
  const rules = ScoringEngine.resolveRules(
    competition.ruleSet,
    settingsToRuleOverrides(competition.settings ?? undefined),
  );

  // Official rounds that contribute to live + official standings.
  // In-progress rounds count entered scores; DNF fill is final after close/approve/lock.
  const LIVE_OR_FINAL = [
    'ACTIVE',
    'PAUSED',
    'CLOSED',
    'PENDING_APPROVAL',
    'APPROVED',
    'LOCKED',
  ] as const;
  const FINAL_FOR_FILL = new Set(['CLOSED', 'PENDING_APPROVAL', 'APPROVED', 'LOCKED']);

  const countableRounds = await prisma.round.findMany({
    where: {
      competitionId,
      type: 'OFFICIAL',
      status: { in: [...LIVE_OR_FINAL] },
    },
    orderBy: { number: 'asc' },
    select: { id: true, number: true, status: true },
  });

  const roundsForScoreFill = countableRounds.map((r) => ({
    id: r.id,
    number: r.number,
    /** Finalized rounds: missing scores are real DNF (count in roundsFlown), not live provisional. */
    isFinal: FINAL_FOR_FILL.has(r.status),
  }));

  const pilots = await prisma.pilot.findMany({
    where: { competitionId },
    include: {
      scores: {
        where: {
          status: { in: ['ENTERED', 'CONFIRMED', 'APPROVED', 'LOCKED'] },
          roundId: { in: countableRounds.map((r) => r.id) },
        },
        include: { round: true },
      },
    },
  });

  const maximumScoreCm = rules.maximumScoreCm;
  const pilotInputs = pilots.flatMap((p) =>
    p.pilotNumber == null
      ? []
      : [{
    pilotId: p.id,
    pilotNumber: p.pilotNumber,
    gender: p.gender,
    isJunior: p.isJunior,
    isWomen: p.isWomen,
    countryId: p.countryId,
    status: p.status,
    roundScores: p.scores
      .filter((s) => s.finalScoreCm != null)
      .map(
        (s): RoundScoreEntry => ({
          pilotId: p.id,
          roundId: s.roundId,
          roundNumber: s.round.number,
          finalScoreCm: Math.min(s.finalScoreCm!, maximumScoreCm),
          // A reflight left unresolved after the round is finished is the maximum score.
          resultType: (
            s.resultType === 'REFLIGHT' && FINAL_FOR_FILL.has(s.round.status)
              ? 'MAXIMUM'
              : s.resultType
          ) as ScoreResultType,
          isBullseye: s.isBullseye,
          isDiscarded: s.isDiscarded,
        }),
      ),
    }],
  );

  // Unscored pilots get maximumScoreCm for every countable round so overall totals
  // are not treated as 0 / best. Live unfilled rounds stay provisional; finished rounds
  // count toward roundsFlown.
  return {
    pilots: ScoringEngine.fillMissingRoundScoresAsDnf(pilotInputs, roundsForScoreFill, rules),
    rules,
  };
}

/**
 * Stored results from an older, higher maximum must not stay above the current cap.
 */
export async function capStoredScoresToMaximum(competitionId: string, maximumScoreCm: number) {
  if (!Number.isFinite(maximumScoreCm) || maximumScoreCm <= 0) return { capped: 0 };

  const over = await prisma.score.findMany({
    where: {
      finalScoreCm: { gt: maximumScoreCm },
      round: { competitionId },
    },
    select: { id: true, distanceCm: true },
  });
  if (over.length === 0) return { capped: 0 };

  await prisma.$transaction(
    over.map((score) =>
      prisma.score.update({
        where: { id: score.id },
        data: {
          finalScoreCm: maximumScoreCm,
          ...(score.distanceCm != null && score.distanceCm > maximumScoreCm
            ? { distanceCm: maximumScoreCm }
            : {}),
        },
      }),
    ),
  );
  return { capped: over.length };
}

/**
 * Persist DNF + maximum score for every flight in the round that still has no score.
 * Called when a round is closed or approved so rankings and the score sheet stay consistent.
 */
export async function assignMissingScoresAsDnf(
  competitionId: string,
  roundId: string,
  enteredById?: string,
) {
  const round = await prisma.round.findFirst({ where: { id: roundId, competitionId } });
  if (!round) throw AppError.notFound('Round not found');
  if (round.status === 'LOCKED') {
    // Locked rounds are immutable — never create or alter scores
    return { assigned: 0, skipped: true as const };
  }

  const competition = await getCompetition(competitionId);
  const rules = ScoringEngine.resolveRules(
    competition.ruleSet,
    settingsToRuleOverrides(competition.settings ?? undefined),
  );

  const flights = await prisma.flight.findMany({
    where: {
      roundId,
      scores: { none: {} },
    },
  });

  if (!flights.length) return { assigned: 0 };

  const computed = ScoringEngine.computeFlightScore(
    {
      pilotId: flights[0].pilotId,
      roundId,
      distanceCm: null,
      resultType: 'DNF',
    },
    rules,
  );

  await prisma.$transaction(
    flights.map((flight) =>
      prisma.score.create({
        data: {
          flightId: flight.id,
          roundId,
          pilotId: flight.pilotId,
          distanceCm: null,
          resultType: 'DNF',
          penaltyCm: 0,
          finalScoreCm: computed.finalScoreCm,
          isBullseye: false,
          status: 'ENTERED',
          judgeNotes: 'Auto-assigned: missing score treated as DNF (maximum)',
          enteredById: enteredById ?? null,
          enteredAt: new Date(),
        },
      }),
    ),
  );

  await prisma.flight.updateMany({
    where: { id: { in: flights.map((f) => f.id) } },
    data: { status: 'SCORED' },
  });

  return { assigned: flights.length, maximumScoreCm: computed.finalScoreCm };
}

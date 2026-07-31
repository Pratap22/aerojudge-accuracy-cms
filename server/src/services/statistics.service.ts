import { formatPilotName } from '@npha/utils';
import { prisma } from '../config/prisma.js';
import { getCompetition } from './competition.service.js';

export async function getCompetitionStatistics(competitionId: string) {
  await getCompetition(competitionId);

  const officialRoundFilter = { competitionId, type: 'OFFICIAL' as const };
  const officialScoreFilter = { round: officialRoundFilter };

  const [
    totalFlights,
    totalBullseyes,
    avgScore,
    bestScore,
    rankings,
    rounds,
  ] = await Promise.all([
    prisma.flight.count({ where: { round: officialRoundFilter } }),
    prisma.score.count({ where: { ...officialScoreFilter, isBullseye: true } }),
    prisma.score.aggregate({
      where: { ...officialScoreFilter, finalScoreCm: { not: null } },
      _avg: { finalScoreCm: true },
    }),
    prisma.score.findFirst({
      where: { ...officialScoreFilter, finalScoreCm: { not: null } },
      orderBy: { finalScoreCm: 'asc' },
      include: {
        pilot: { select: { firstName: true, lastName: true } },
        round: { select: { number: true } },
      },
    }),
    prisma.individualRanking.findMany({
      where: { competitionId, category: 'OVERALL' },
      orderBy: { rank: 'asc' },
      take: 10,
      include: { pilot: { select: { firstName: true, lastName: true } } },
    }),
    prisma.round.findMany({
      where: officialRoundFilter,
      orderBy: { number: 'asc' },
      select: { id: true, number: true },
    }),
  ]);

  const scoredFlights = await prisma.score.count({
    where: { ...officialScoreFilter, finalScoreCm: { not: null } },
  });

  const roundAverages = await Promise.all(
    rounds.map(async (round) => {
      const [avg, bullseyes] = await Promise.all([
        prisma.score.aggregate({
          where: { roundId: round.id, finalScoreCm: { not: null } },
          _avg: { finalScoreCm: true },
        }),
        prisma.score.count({ where: { roundId: round.id, isBullseye: true } }),
      ]);
      return {
        round: round.number,
        avgScoreCm: avg._avg.finalScoreCm ?? 0,
        bullseyes,
      };
    }),
  );

  const topPilots = rankings.map((r) => ({
    rank: r.rank,
    pilotName: formatPilotName(r.pilot.firstName, r.pilot.lastName),
    bullseyes: r.bullseyes,
    avgScoreCm: r.roundsFlown > 0 ? r.totalScoreCm / r.roundsFlown : r.totalScoreCm,
  }));

  return {
    totalFlights,
    totalBullseyes,
    bullseyeRate: scoredFlights > 0 ? totalBullseyes / scoredFlights : 0,
    averageScoreCm: avgScore._avg.finalScoreCm ?? 0,
    bestSingleScore: bestScore
      ? {
          pilotName: formatPilotName(bestScore.pilot.firstName, bestScore.pilot.lastName),
          scoreCm: bestScore.finalScoreCm ?? 0,
          round: bestScore.round.number,
        }
      : null,
    topPilots,
    roundAverages,
  };
}

export async function getRoundStatistics(competitionId: string, roundId: string) {
  const round = await prisma.round.findFirst({ where: { id: roundId, competitionId } });
  if (!round) return null;

  const [scoreStats, flightCount] = await Promise.all([
    prisma.score.aggregate({
      where: { roundId },
      _avg: { finalScoreCm: true },
      _min: { finalScoreCm: true },
      _max: { finalScoreCm: true },
      _count: true,
    }),
    prisma.flight.count({ where: { roundId } }),
  ]);

  return {
    roundId,
    roundNumber: round.number,
    flightCount,
    scoresEntered: scoreStats._count,
    averageScoreCm: scoreStats._avg.finalScoreCm,
    bestScoreCm: scoreStats._min.finalScoreCm,
    worstScoreCm: scoreStats._max.finalScoreCm,
  };
}

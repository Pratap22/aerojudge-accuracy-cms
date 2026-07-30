import { prisma } from '../config/prisma.js';
import { getCompetition } from './competition.service.js';

export async function getCompetitionStatistics(competitionId: string) {
  await getCompetition(competitionId);

  const [
    pilotCount,
    teamCount,
    roundCount,
    scoreCount,
    bullseyeCount,
    avgScore,
    flightsByStatus,
  ] = await Promise.all([
    prisma.pilot.count({ where: { competitionId } }),
    prisma.team.count({ where: { competitionId } }),
    prisma.round.count({ where: { competitionId } }),
    prisma.score.count({ where: { round: { competitionId } } }),
    prisma.score.count({ where: { round: { competitionId }, isBullseye: true } }),
    prisma.score.aggregate({
      where: { round: { competitionId }, finalScoreCm: { not: null } },
      _avg: { finalScoreCm: true },
    }),
    prisma.flight.groupBy({
      by: ['status'],
      where: { round: { competitionId } },
      _count: true,
    }),
  ]);

  const topPilots = await prisma.individualRanking.findMany({
    where: { competitionId, category: 'OVERALL' },
    orderBy: { rank: 'asc' },
    take: 10,
    include: { pilot: { include: { country: true } } },
  });

  return {
    pilotCount,
    teamCount,
    roundCount,
    scoreCount,
    bullseyeCount,
    averageScoreCm: avgScore._avg.finalScoreCm,
    flightsByStatus: Object.fromEntries(flightsByStatus.map((f) => [f.status, f._count])),
    topPilots,
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

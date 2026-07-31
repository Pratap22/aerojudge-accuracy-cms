import { prisma } from '../config/prisma.js';
import { getCompetition } from './competition.service.js';

export async function getCompetitionDashboard(competitionId: string) {
  await getCompetition(competitionId);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [
    totalPilots,
    totalTeams,
    roundsTotal,
    roundsCompleted,
    activeRound,
    bullseyesToday,
    latestWind,
  ] = await Promise.all([
    prisma.pilot.count({ where: { competitionId } }),
    prisma.team.count({ where: { competitionId } }),
    prisma.round.count({ where: { competitionId, type: 'OFFICIAL' } }),
    prisma.round.count({
      where: {
        competitionId,
        type: 'OFFICIAL',
        status: { in: ['CLOSED', 'PENDING_APPROVAL', 'APPROVED', 'LOCKED'] },
      },
    }),
    prisma.round.findFirst({
      where: {
        competitionId,
        status: { in: ['ACTIVE', 'OPEN', 'PAUSED', 'BRIEFING'] },
      },
      orderBy: { number: 'desc' },
      select: { id: true, number: true, name: true, status: true },
    }),
    prisma.score.count({
      where: {
        isBullseye: true,
        enteredAt: { gte: startOfDay },
        round: { competitionId, type: 'OFFICIAL' },
      },
    }),
    prisma.wind.findFirst({
      where: { competitionId },
      orderBy: { recordedAt: 'desc' },
    }),
  ]);

  return {
    totalPilots,
    totalTeams,
    activeRound,
    roundsCompleted,
    roundsTotal,
    bullseyesToday,
    windSpeedMs: latestWind?.speedMs ?? 0,
    windDirectionDeg: latestWind?.directionDeg ?? 0,
  };
}

import { prisma } from '../config/prisma.js';
import { getCompetition } from './competition.service.js';

export async function recordWeather(
  competitionId: string,
  data: {
    temperatureC?: number;
    humidityPct?: number;
    pressureHpa?: number;
    conditions?: string;
    source?: string;
  },
) {
  await getCompetition(competitionId);
  return prisma.weather.create({
    data: { competitionId, ...data },
  });
}

export async function listWeather(competitionId: string, limit = 50) {
  await getCompetition(competitionId);
  return prisma.weather.findMany({
    where: { competitionId },
    orderBy: { recordedAt: 'desc' },
    take: limit,
  });
}

export async function recordWind(
  competitionId: string,
  data: {
    directionDeg: number;
    speedMs: number;
    gustMs?: number;
    source?: string;
  },
) {
  await getCompetition(competitionId);
  return prisma.wind.create({
    data: { competitionId, ...data },
  });
}

export async function listWind(competitionId: string, limit = 50) {
  await getCompetition(competitionId);
  return prisma.wind.findMany({
    where: { competitionId },
    orderBy: { recordedAt: 'desc' },
    take: limit,
  });
}

export async function getLatestWind(competitionId: string) {
  await getCompetition(competitionId);
  return prisma.wind.findFirst({
    where: { competitionId },
    orderBy: { recordedAt: 'desc' },
  });
}

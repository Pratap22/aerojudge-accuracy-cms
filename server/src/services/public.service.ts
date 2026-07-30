import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';

export async function getPublicCompetition(slug: string) {
  const competition = await prisma.competition.findFirst({
    where: { publicSlug: slug, isPublished: true },
    select: {
      id: true,
      name: true,
      code: true,
      organizer: true,
      venue: true,
      country: true,
      startDate: true,
      endDate: true,
      status: true,
      publicSlug: true,
      settings: { select: { livePublicResults: true } },
    },
  });
  if (!competition) throw AppError.notFound('Competition not found');
  if (!competition.settings?.livePublicResults) {
    throw AppError.forbidden('Public results are not enabled for this competition');
  }
  return competition;
}

export async function getPublicResults(slug: string, category = 'OVERALL') {
  const competition = await getPublicCompetition(slug);

  const result = await prisma.result.findFirst({
    where: {
      competitionId: competition.id,
      category,
      roundId: null,
      isOfficial: true,
    },
  });

  const rankings = await prisma.individualRanking.findMany({
    where: { competitionId: competition.id, category },
    orderBy: { rank: 'asc' },
    include: {
      pilot: {
        select: {
          pilotNumber: true,
          firstName: true,
          lastName: true,
          nationality: true,
          country: { select: { name: true, code: true } },
        },
      },
    },
  });

  return {
    competition,
    category,
    official: !!result?.isOfficial,
    publishedAt: result?.publishedAt,
    rankings,
    payload: result?.payloadJson ?? null,
  };
}

export async function getPublicRoundResults(slug: string, roundNumber: number) {
  const competition = await getPublicCompetition(slug);
  const round = await prisma.round.findFirst({
    where: { competitionId: competition.id, number: roundNumber },
  });
  if (!round) throw AppError.notFound('Round not found');

  const scores = await prisma.score.findMany({
    where: { roundId: round.id, status: { in: ['CONFIRMED', 'APPROVED', 'LOCKED'] } },
    include: {
      pilot: {
        select: {
          pilotNumber: true,
          firstName: true,
          lastName: true,
          country: { select: { name: true } },
        },
      },
    },
    orderBy: { finalScoreCm: 'asc' },
  });

  return { competition, round, scores };
}

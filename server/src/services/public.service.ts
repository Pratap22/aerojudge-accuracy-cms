import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { recalculateRankings } from './scoring.service.js';

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
    },
    orderBy: [{ isOfficial: 'desc' }, { updatedAt: 'desc' }],
  });

  if (category === 'TEAM') {
    let teamRankings = await prisma.teamRanking.findMany({
      where: { competitionId: competition.id },
      orderBy: { rank: 'asc' },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            country: { select: { name: true, code: true, code2: true } },
          },
        },
      },
    });

    if (teamRankings.length === 0) {
      const teamCount = await prisma.team.count({ where: { competitionId: competition.id } });
      if (teamCount > 0) {
        await recalculateRankings(competition.id);
        teamRankings = await prisma.teamRanking.findMany({
          where: { competitionId: competition.id },
          orderBy: { rank: 'asc' },
          include: {
            team: {
              select: {
                id: true,
                name: true,
                country: { select: { name: true, code: true, code2: true } },
              },
            },
          },
        });
      }
    }

    const rankings = teamRankings.map((r) => ({
      id: r.id,
      teamId: r.teamId,
      rank: r.rank,
      totalScoreCm: r.totalScoreCm,
      roundsFlown: r.roundsScored,
      bullseyes: 0,
      team: {
        id: r.team.id,
        name: r.team.name,
        country: r.team.country
          ? {
              name: r.team.country.name,
              code: r.team.country.code2 || r.team.country.code,
            }
          : null,
      },
      pilot: null,
    }));

    return {
      competition,
      category,
      official: !!result?.isOfficial,
      publishedAt: result?.publishedAt,
      rankings,
      payload: result?.payloadJson ?? null,
    };
  }

  if (category === 'COUNTRY') {
    const payload = Array.isArray(result?.payloadJson) ? (result.payloadJson as Array<{
      countryId: string;
      rank: number;
      totalScoreCm: number;
      pilotIds?: string[];
    }>) : [];

    const countryIds = payload.map((r) => r.countryId).filter(Boolean);
    const countries = countryIds.length
      ? await prisma.country.findMany({
          where: { id: { in: countryIds } },
          select: { id: true, name: true, code: true, code2: true },
        })
      : [];
    const countryById = new Map(countries.map((c) => [c.id, c]));

    const rankings = payload
      .slice()
      .sort((a, b) => a.rank - b.rank)
      .map((r) => {
        const country = countryById.get(r.countryId);
        return {
          id: r.countryId,
          countryId: r.countryId,
          rank: r.rank,
          totalScoreCm: r.totalScoreCm,
          roundsFlown: r.pilotIds?.length ?? 0,
          bullseyes: 0,
          country: country
            ? { name: country.name, code: country.code2 || country.code }
            : { name: r.countryId, code: 'XX' },
          pilot: null,
          team: null,
        };
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

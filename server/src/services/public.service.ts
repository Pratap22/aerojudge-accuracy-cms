import { generateQrPayload } from '@npha/utils';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { toAbsoluteAssetUrl } from '../utils/assets.js';
import { syncCompetitionStatusFromRounds } from './competition.service.js';
import { recalculateRankings } from './scoring.service.js';
import { resolveCountryId, toPublicCountry } from '../utils/country-resolve.js';

const ACTIVE_STATUSES = new Set(['REGISTRATION', 'PRACTICE', 'OFFICIAL', 'PAUSED']);
const PAST_STATUSES = new Set(['COMPLETED', 'CANCELLED']);

const publicCompetitionSelect = {
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
  settings: {
    select: {
      livePublicResults: true,
      partnersLabel: true,
      partnerTiersEnabled: true,
    },
  },
} as const;

/** Resolve by competition id or publicSlug. */
export async function getPublicCompetition(slugOrId: string) {
  const found = await prisma.competition.findFirst({
    where: {
      isPublished: true,
      status: { notIn: ['DRAFT', 'ARCHIVED'] },
      OR: [{ id: slugOrId }, { publicSlug: slugOrId }],
    },
    select: { id: true, settings: { select: { livePublicResults: true } } },
  });
  if (!found) throw AppError.notFound('Competition not found');
  if (!found.settings?.livePublicResults) {
    throw AppError.forbidden('Public results are not enabled for this competition');
  }

  // Heal stuck REGISTRATION when official rounds already have progress (e.g. SQL import).
  await syncCompetitionStatusFromRounds(found.id);

  const competition = await prisma.competition.findFirst({
    where: { id: found.id },
    select: publicCompetitionSelect,
  });
  if (!competition) throw AppError.notFound('Competition not found');
  return competition;
}

export async function listPublicCompetitions() {
  const competitions = await prisma.competition.findMany({
    where: {
      isPublished: true,
      settings: { livePublicResults: true },
      status: { notIn: ['DRAFT', 'ARCHIVED'] },
    },
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
      _count: {
        select: {
          pilots: true,
          teams: true,
          rounds: { where: { type: 'OFFICIAL' } },
        },
      },
    },
    orderBy: [{ startDate: 'desc' }, { name: 'asc' }],
  });

  const mapSummary = (c: (typeof competitions)[number]) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    organizer: c.organizer,
    venue: c.venue,
    country: c.country,
    startDate: c.startDate,
    endDate: c.endDate,
    status: c.status,
    publicSlug: c.publicSlug,
    pilotCount: c._count.pilots,
    teamCount: c._count.teams,
    roundCount: c._count.rounds,
  });

  const active = competitions.filter((c) => ACTIVE_STATUSES.has(c.status)).map(mapSummary);
  const past = competitions.filter((c) => PAST_STATUSES.has(c.status)).map(mapSummary);

  return { active, past };
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
          country: { select: { name: true, code: true, code2: true } },
        },
      },
    },
  });

  return {
    competition,
    category,
    official: !!result?.isOfficial,
    publishedAt: result?.publishedAt,
    rankings: rankings.map((r) => ({
      ...r,
      pilot: r.pilot
        ? {
            ...r.pilot,
            country: toPublicCountry(r.pilot.country),
          }
        : null,
    })),
    payload: result?.payloadJson ?? null,
  };
}

export async function getPublicRoundResults(slug: string, roundNumber: number) {
  const competition = await getPublicCompetition(slug);
  const round = await prisma.round.findFirst({
    where: {
      competitionId: competition.id,
      number: roundNumber,
      type: 'OFFICIAL',
    },
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

export async function getPublicRoundsStatus(slugOrId: string) {
  const competition = await getPublicCompetition(slugOrId);
  const rounds = await prisma.round.findMany({
    where: { competitionId: competition.id },
    select: { id: true, number: true, status: true },
    orderBy: { number: 'asc' },
  });
  return { competitionId: competition.id, rounds };
}

export async function getLatestPublicScore(slugOrId: string) {
  const competition = await getPublicCompetition(slugOrId);

  const score = await prisma.score.findFirst({
    where: {
      round: { competitionId: competition.id },
      status: { in: ['ENTERED', 'CONFIRMED', 'APPROVED', 'LOCKED'] },
      finalScoreCm: { not: null },
    },
    orderBy: [{ enteredAt: 'desc' }, { updatedAt: 'desc' }],
    select: {
      id: true,
      pilotId: true,
      finalScoreCm: true,
      isBullseye: true,
      resultType: true,
      enteredAt: true,
      round: { select: { number: true } },
      pilot: {
        select: {
          id: true,
          pilotNumber: true,
          firstName: true,
          lastName: true,
          nationality: true,
          country: { select: { name: true, code: true, code2: true } },
        },
      },
    },
  });

  if (!score) return null;

  const flagCode =
    score.pilot.country?.code2 ||
    (score.pilot.country?.code.length === 2 ? score.pilot.country.code : null) ||
    'XX';

  return {
    competitionId: competition.id,
    pilotId: score.pilotId,
    pilotNumber: score.pilot.pilotNumber,
    firstName: score.pilot.firstName,
    lastName: score.pilot.lastName,
    countryCode: flagCode,
    countryName: score.pilot.country?.name ?? score.pilot.nationality ?? null,
    scoreCm: score.finalScoreCm,
    isBullseye: score.isBullseye,
    resultType: score.resultType,
    resultLabel:
      score.resultType !== 'MEASURED' && score.resultType !== 'BULLSEYE'
        ? score.resultType
        : undefined,
    roundNumber: score.round.number,
    enteredAt: score.enteredAt,
  };
}

export async function getPublicSponsors(slugOrId: string) {
  const competition = await getPublicCompetition(slugOrId);
  const rows = await prisma.sponsor.findMany({
    where: { competitionId: competition.id, isActive: true },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  });
  return rows.map((row) => ({
    id: row.id,
    competitionId: row.competitionId,
    name: row.name,
    type: row.tier,
    logoUrl: toAbsoluteAssetUrl(row.logoUrl),
    websiteUrl: row.websiteUrl,
    displayOrder: row.displayOrder,
    isActive: row.isActive,
  }));
}

const PUBLIC_REGISTRATION_STATUSES = new Set(['REGISTRATION', 'PRACTICE']);

export async function listPublicCountries() {
  return prisma.country.findMany({
    select: { id: true, code: true, code2: true, name: true },
    orderBy: { name: 'asc' },
  });
}

export async function listPublicPilots(slugOrId: string) {
  const competition = await getPublicCompetition(slugOrId);
  const pilots = await prisma.pilot.findMany({
    where: {
      competitionId: competition.id,
      status: { notIn: ['WITHDRAWN', 'DISQUALIFIED'] },
    },
    orderBy: [{ pilotNumber: 'asc' }],
    select: {
      id: true,
      pilotNumber: true,
      firstName: true,
      lastName: true,
      gender: true,
      nationality: true,
      club: true,
      glider: true,
      status: true,
      isWomen: true,
      isJunior: true,
      country: { select: { name: true, code: true, code2: true } },
    },
  });
  return {
    competitionId: competition.id,
    competitionName: competition.name,
    registrationOpen: PUBLIC_REGISTRATION_STATUSES.has(competition.status),
    pilots: pilots.map((p) => ({
      ...p,
      country: toPublicCountry(p.country),
    })),
  };
}

export async function registerPublicPilot(
  slugOrId: string,
  input: {
    firstName: string;
    lastName: string;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    countryCode?: string;
    nationality?: string;
    faiLicense?: string;
    civlId?: string;
    club?: string;
    dateOfBirth?: string | Date;
    glider?: string;
    harness?: string;
    emergencyContact?: string;
    emergencyPhone?: string;
  },
) {
  const competition = await getPublicCompetition(slugOrId);

  if (!PUBLIC_REGISTRATION_STATUSES.has(competition.status)) {
    throw AppError.badRequest(
      'Pilot registration is closed for this competition',
      'REGISTRATION_CLOSED',
    );
  }

  const full = await prisma.competition.findUnique({
    where: { id: competition.id },
    select: {
      publicSlug: true,
      brandingJson: true,
      settings: { select: { juniorMaxAge: true, juniorCategoryEnabled: true } },
    },
  });

  const pilotCount = await prisma.pilot.count({ where: { competitionId: competition.id } });
  const branding = (full?.brandingJson ?? null) as { maxPilots?: number } | null;
  const cap = branding?.maxPilots;
  if (cap != null && Number.isFinite(cap) && pilotCount >= cap) {
    throw AppError.badRequest(
      `Registration is full (${cap} pilots maximum)`,
      'REGISTRATION_FULL',
    );
  }

  let countryId: string | undefined;
  let nationality = input.nationality;
  if (input.countryCode) {
    countryId = (await resolveCountryId(input.countryCode)) ?? undefined;
    if (!countryId) {
      throw AppError.badRequest(`Unknown country code: ${input.countryCode}`, 'INVALID_COUNTRY');
    }
    const country = await prisma.country.findUnique({ where: { id: countryId } });
    nationality = nationality ?? country?.name;
  } else if (nationality) {
    countryId = (await resolveCountryId(nationality)) ?? undefined;
  }

  const maxNumber = await prisma.pilot.aggregate({
    where: { competitionId: competition.id },
    _max: { pilotNumber: true },
  });
  const pilotNumber = (maxNumber._max.pilotNumber ?? 0) + 1;

  let dateOfBirth: Date | undefined;
  if (input.dateOfBirth) {
    dateOfBirth =
      input.dateOfBirth instanceof Date
        ? input.dateOfBirth
        : new Date(input.dateOfBirth);
    if (Number.isNaN(dateOfBirth.getTime())) {
      throw AppError.badRequest('Invalid date of birth');
    }
  }

  const juniorMaxAge = full?.settings?.juniorMaxAge ?? 25;
  let isJunior = false;
  if (dateOfBirth && full?.settings?.juniorCategoryEnabled !== false) {
    const ageMs = Date.now() - dateOfBirth.getTime();
    const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
    isJunior = ageYears < juniorMaxAge;
  }

  const qrCode = generateQrPayload(
    env.PUBLIC_RESULTS_URL,
    full?.publicSlug ?? competition.publicSlug,
    `/pilot/${pilotNumber}`,
  );

  const pilot = await prisma.pilot.create({
    data: {
      competitionId: competition.id,
      pilotNumber,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      gender: input.gender,
      nationality: nationality ?? null,
      countryId: countryId ?? null,
      faiLicense: input.faiLicense ?? null,
      civlId: input.civlId ?? null,
      club: input.club ?? null,
      dateOfBirth: dateOfBirth ?? null,
      glider: input.glider ?? null,
      harness: input.harness ?? null,
      emergencyContact: input.emergencyContact ?? null,
      emergencyPhone: input.emergencyPhone ?? null,
      status: 'REGISTERED',
      isWomen: input.gender === 'FEMALE',
      isJunior,
      qrCode,
    },
    include: {
      country: { select: { name: true, code: true, code2: true } },
    },
  });

  return {
    id: pilot.id,
    pilotNumber: pilot.pilotNumber,
    firstName: pilot.firstName,
    lastName: pilot.lastName,
    gender: pilot.gender,
    nationality: pilot.nationality,
    club: pilot.club,
    glider: pilot.glider,
    status: pilot.status,
    country: pilot.country,
    competitionId: competition.id,
    competitionName: competition.name,
  };
}

import { compareOfficials, isEmptyHtml } from '@npha/shared';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { toAbsoluteAssetUrl } from '../utils/assets.js';
import { syncCompetitionStatusFromRounds } from './competition.service.js';
import { recalculateRankings } from './scoring.service.js';
import { resolveCountryId, toPublicCountry } from '../utils/country-resolve.js';
import {
  displayedPilotPhotoUrl,
  pilotPhotoWithPersonSelect,
} from './person.service.js';

const ACTIVE_STATUSES = new Set(['REGISTRATION', 'PRACTICE', 'OFFICIAL', 'PAUSED']);
const PAST_STATUSES = new Set(['COMPLETED', 'CANCELLED']);

const publicCompetitionSelect = {
  id: true,
  name: true,
  code: true,
  organizer: true,
  organizerLogoUrl: true,
  logoUrl: true,
  venue: true,
  country: true,
  startDate: true,
  endDate: true,
  status: true,
  publicSlug: true,
  organization: {
    select: {
      name: true,
      shortName: true,
      logoUrl: true,
    },
  },
  settings: {
    select: {
      livePublicResults: true,
      partnersLabel: true,
      partnerTiersEnabled: true,
    },
  },
  info: {
    select: {
      aboutHtml: true,
      dailyScheduleHtml: true,
      selectionRulesHtml: true,
      entryFeePaymentHtml: true,
      flyingSiteHtml: true,
      travelInfoHtml: true,
    },
  },
  latitude: true,
  longitude: true,
  _count: {
    select: {
      galleryImages: true,
      links: true,
      contacts: { where: { isPublic: true } },
    },
  },
} as const;

/** Public-facing organiser card (owning org + optional competition branding). */
export function toPublicOrganiser(competition: {
  organizer: string;
  organizerLogoUrl?: string | null;
  logoUrl?: string | null;
  organization?: {
    name: string;
    shortName: string;
    logoUrl: string | null;
  } | null;
}) {
  const name =
    competition.organizer?.trim() ||
    competition.organization?.name?.trim() ||
    competition.organization?.shortName?.trim() ||
    '';
  if (!name) return null;

  const logoUrl = toAbsoluteAssetUrl(
    competition.organizerLogoUrl ||
      competition.organization?.logoUrl ||
      competition.logoUrl ||
      null,
  );

  return {
    name,
    logoUrl,
    role: 'Organiser' as const,
  };
}

function mapPublicCompetition(competition: {
  id: string;
  name: string;
  code: string;
  organizer: string;
  organizerLogoUrl?: string | null;
  logoUrl?: string | null;
  venue: string;
  country: string;
  startDate: Date;
  endDate: Date;
  status: string;
  publicSlug: string;
  latitude?: number | null;
  longitude?: number | null;
  organization?: {
    name: string;
    shortName: string;
    logoUrl: string | null;
  } | null;
  settings: {
    livePublicResults: boolean;
    partnersLabel: string | null;
    partnerTiersEnabled: boolean;
  } | null;
  info?: {
    aboutHtml: string | null;
    dailyScheduleHtml: string | null;
    selectionRulesHtml: string | null;
    entryFeePaymentHtml: string | null;
    flyingSiteHtml: string | null;
    travelInfoHtml: string | null;
  } | null;
  _count?: {
    galleryImages: number;
    links: number;
    contacts: number;
  };
}) {
  const info = competition.info;
  const hasInfo =
    !isEmptyHtml(info?.aboutHtml) ||
    !isEmptyHtml(info?.dailyScheduleHtml) ||
    !isEmptyHtml(info?.selectionRulesHtml) ||
    !isEmptyHtml(info?.entryFeePaymentHtml) ||
    !isEmptyHtml(info?.flyingSiteHtml) ||
    !isEmptyHtml(info?.travelInfoHtml) ||
    (competition.latitude != null && competition.longitude != null) ||
    (competition._count?.galleryImages ?? 0) > 0 ||
    (competition._count?.links ?? 0) > 0 ||
    (competition._count?.contacts ?? 0) > 0;

  return {
    id: competition.id,
    name: competition.name,
    code: competition.code,
    organizer: competition.organizer,
    venue: competition.venue,
    country: competition.country,
    startDate: competition.startDate,
    endDate: competition.endDate,
    status: competition.status,
    publicSlug: competition.publicSlug,
    settings: competition.settings,
    organiser: toPublicOrganiser(competition),
    hasInfo,
  };
}

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
  return mapPublicCompetition(competition);
}

export async function listPublicCompetitions() {
  const completedRoundStatuses = [
    'CLOSED',
    'PENDING_APPROVAL',
    'APPROVED',
    'LOCKED',
  ] as const;
  const scoringRoundStatuses = [
    'ACTIVE',
    'PAUSED',
    'CLOSED',
    'PENDING_APPROVAL',
    'APPROVED',
    'LOCKED',
  ] as const;

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
          rounds: {
            where: {
              type: 'OFFICIAL',
              status: { notIn: ['CANCELLED'] },
            },
          },
        },
      },
    },
    orderBy: [{ startDate: 'desc' }, { name: 'asc' }],
  });

  const completedRoundCounts =
    competitions.length === 0
      ? []
      : await prisma.round.groupBy({
          by: ['competitionId'],
          where: {
            type: 'OFFICIAL',
            status: { in: [...completedRoundStatuses] },
            competitionId: { in: competitions.map((c) => c.id) },
          },
          _count: { _all: true },
        });
  const completedByCompetition = new Map(
    completedRoundCounts.map((row) => [row.competitionId, row._count._all]),
  );

  const scoringRoundCounts =
    competitions.length === 0
      ? []
      : await prisma.round.groupBy({
          by: ['competitionId'],
          where: {
            type: 'OFFICIAL',
            status: { in: [...scoringRoundStatuses] },
            competitionId: { in: competitions.map((c) => c.id) },
          },
          _count: { _all: true },
        });
  const scoringByCompetition = new Map(
    scoringRoundCounts.map((row) => [row.competitionId, row._count._all]),
  );

  const mapSummary = (c: (typeof competitions)[number]) => {
    const completedRounds = completedByCompetition.get(c.id) ?? 0;
    const scoringRounds = scoringByCompetition.get(c.id) ?? 0;
    // Public "X rounds" must match results: use completed/scoring counts, not draft SCHEDULED rows.
    const roundCount =
      completedRounds > 0
        ? completedRounds
        : scoringRounds > 0
          ? scoringRounds
          : c._count.rounds;

    return {
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
      roundCount,
      completedRounds,
      scoringRounds,
    };
  };

  const active = competitions.filter((c) => ACTIVE_STATUSES.has(c.status)).map(mapSummary);
  const past = competitions.filter((c) => PAST_STATUSES.has(c.status)).map(mapSummary);

  return { active, past };
}

export async function getPublicResults(slug: string, category = 'OVERALL') {
  const competition = await getPublicCompetition(slug);

  // When official/scoring rounds exceed stored "roundsFlown", rankings were calculated
  // under the old provisional-fill rule (or discarded team rounds). Recalculate once.
  const scoringRounds = await prisma.round.count({
    where: {
      competitionId: competition.id,
      type: 'OFFICIAL',
      status: {
        in: ['ACTIVE', 'PAUSED', 'CLOSED', 'PENDING_APPROVAL', 'APPROVED', 'LOCKED'],
      },
    },
  });
  if (scoringRounds > 0) {
    const maxFlown = await prisma.individualRanking.aggregate({
      where: { competitionId: competition.id, category: 'OVERALL' },
      _max: { roundsFlown: true },
    });
    const maxTeam = await prisma.teamRanking.aggregate({
      where: { competitionId: competition.id },
      _max: { roundsScored: true },
    });
    const maxStored = Math.max(maxFlown._max.roundsFlown ?? 0, maxTeam._max.roundsScored ?? 0);
    if (maxStored > 0 && maxStored < scoringRounds) {
      await recalculateRankings(competition.id);
    }
  }

  // Stale team scores: empty-roster bug left totals at 1× or N× maximum while
  // members now have real sub-maximum scores. Heal on read for public boards.
  if (category === 'TEAM') {
    const settings = await prisma.competitionSettings.findUnique({
      where: { competitionId: competition.id },
      select: { maximumScoreCm: true, teamScoringPilots: true },
    });
    const maxCm = settings?.maximumScoreCm ?? 1000;
    const scoringPilots = settings?.teamScoringPilots ?? 3;
    const absFillTotal = maxCm * scoringPilots;
    const staleMaxTotals = await prisma.teamScore.count({
      where: {
        team: { competitionId: competition.id },
        OR: [{ totalScoreCm: maxCm }, { totalScoreCm: absFillTotal }],
      },
    });
    if (staleMaxTotals > 0) {
      const betterPilotScore = await prisma.score.findFirst({
        where: {
          flight: { round: { competitionId: competition.id, type: 'OFFICIAL' } },
          finalScoreCm: { not: null, lt: maxCm },
          status: { in: ['ENTERED', 'CONFIRMED', 'APPROVED', 'LOCKED'] },
          pilot: { teamMembers: { some: { team: { competitionId: competition.id } } } },
        },
        select: { id: true },
      });
      if (betterPilotScore) {
        await recalculateRankings(competition.id);
      }
    }
  }

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
            members: {
              orderBy: { order: 'asc' },
              select: {
                order: true,
                role: true,
                pilot: {
                  select: {
                    id: true,
                    pilotNumber: true,
                    firstName: true,
                    lastName: true,
                    ...pilotPhotoWithPersonSelect,
                  },
                },
              },
            },
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
                members: {
                  orderBy: { order: 'asc' },
                  select: {
                    order: true,
                    role: true,
                    pilot: {
                      select: {
                        id: true,
                        pilotNumber: true,
                        firstName: true,
                        lastName: true,
                        ...pilotPhotoWithPersonSelect,
                      },
                    },
                  },
                },
              },
            },
          },
        });
      }
    }

    const scoringRoundRows = await prisma.round.findMany({
      where: {
        competitionId: competition.id,
        type: 'OFFICIAL',
        status: {
          in: ['ACTIVE', 'PAUSED', 'CLOSED', 'PENDING_APPROVAL', 'APPROVED', 'LOCKED'],
        },
      },
      orderBy: { number: 'asc' },
      select: { id: true, number: true },
    });
    const roundNumbers = scoringRoundRows.map((r) => r.number);
    const roundIds = scoringRoundRows.map((r) => r.id);

    type PilotContrib = {
      pilotId: string;
      scoreCm: number;
      counted: boolean;
      reason?: string;
      isReserve?: boolean;
    };

    const teamIds = teamRankings.map((r) => r.teamId);
    const teamScores =
      teamIds.length && roundIds.length
        ? await prisma.teamScore.findMany({
            where: { teamId: { in: teamIds }, roundId: { in: roundIds } },
          })
        : [];

    const contribByTeamRound = new Map<string, Map<string, PilotContrib>>();
    const teamRoundTotals = new Map<string, { roundId: string; totalScoreCm: number }[]>();

    for (const ts of teamScores) {
      const key = `${ts.teamId}:${ts.roundId}`;
      const map = new Map<string, PilotContrib>();
      const counted = (ts.countedPilots as PilotContrib[] | null) ?? [];
      const discarded = (ts.discardedPilots as PilotContrib[] | null) ?? [];
      for (const c of counted) map.set(c.pilotId, { ...c, counted: true });
      for (const c of discarded) map.set(c.pilotId, { ...c, counted: false });
      contribByTeamRound.set(key, map);

      const list = teamRoundTotals.get(ts.teamId) ?? [];
      list.push({ roundId: ts.roundId, totalScoreCm: ts.totalScoreCm });
      teamRoundTotals.set(ts.teamId, list);
    }

    const pilotIds = [
      ...new Set(
        teamRankings.flatMap((r) => r.team.members.map((m) => m.pilot.id).filter(Boolean)),
      ),
    ];
    const rawScores =
      pilotIds.length && roundIds.length
        ? await prisma.score.findMany({
            where: {
              pilotId: { in: pilotIds },
              roundId: { in: roundIds },
              status: { in: ['ENTERED', 'CONFIRMED', 'APPROVED', 'LOCKED'] },
              finalScoreCm: { not: null },
            },
            select: {
              pilotId: true,
              roundId: true,
              finalScoreCm: true,
              isBullseye: true,
              resultType: true,
            },
          })
        : [];
    const rawByPilotRound = new Map(
      rawScores.map((s) => [`${s.pilotId}:${s.roundId}`, s] as const),
    );

    const rankings = teamRankings.map((r) => {
      const totals = teamRoundTotals.get(r.teamId) ?? [];
      const totalByRoundId = new Map(totals.map((t) => [t.roundId, t.totalScoreCm]));
      // Sum every team round (no worst-round discards). Prefer live TeamScore sum so
      // the public board is correct even before a full recalculate after engine changes.
      const summedRoundTotal = totals.reduce((s, t) => s + t.totalScoreCm, 0);

      const roundScores = scoringRoundRows.map((round) => {
        const total = totalByRoundId.get(round.id);
        return {
          round: round.number,
          scoreCm: total != null ? total : null,
          // Team round scores are never struck — only pilot cells within a round can be.
          isDiscarded: false,
          isBullseye: false,
          isProvisional: total == null,
        };
      });

      const pilots = r.team.members
        .filter((m) => m.pilot)
        .map((m) => {
          const pilot = m.pilot;
          const pilotRoundScores = scoringRoundRows.map((round) => {
            const contrib = contribByTeamRound.get(`${r.teamId}:${round.id}`)?.get(pilot.id);
            const raw = rawByPilotRound.get(`${pilot.id}:${round.id}`);
            const scoreCm =
              contrib?.scoreCm ??
              (typeof raw?.finalScoreCm === 'number' ? raw.finalScoreCm : null);
            const counted = contrib ? contrib.counted : true;
            const empty = scoreCm == null;
            return {
              round: round.number,
              scoreCm: empty ? null : scoreCm,
              isBullseye: Boolean(raw?.isBullseye) && counted,
              // Strike when present but not counted toward the team round total (worst pilot).
              isDiscarded: !empty && contrib ? !contrib.counted : false,
              isProvisional: false,
              resultType: raw?.resultType,
            };
          });

          return {
            pilotId: pilot.id,
            pilotNumber: pilot.pilotNumber,
            firstName: pilot.firstName,
            lastName: pilot.lastName,
            photoUrl: displayedPilotPhotoUrl(pilot),
            role: m.role,
            roundScores: pilotRoundScores,
          };
        });

      return {
        id: r.id,
        teamId: r.teamId,
        rank: r.rank,
        totalScoreCm: totals.length > 0 ? summedRoundTotal : r.totalScoreCm,
        roundsFlown: r.roundsScored,
        bullseyes: 0,
        roundScores,
        pilots,
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
      };
    });

    // Re-order ranks by corrected totals when DB still has discarded-round totals.
    const ranked = rankings
      .slice()
      .sort((a, b) => {
        if (a.totalScoreCm !== b.totalScoreCm) return a.totalScoreCm - b.totalScoreCm;
        return a.rank - b.rank;
      })
      .map((row, i) => ({ ...row, rank: i + 1 }));

    return {
      competition,
      category,
      official: !!result?.isOfficial,
      publishedAt: result?.publishedAt,
      rankings: ranked,
      scoringRounds,
      roundNumbers,
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
      scoringRounds,
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
          ...pilotPhotoWithPersonSelect,
          country: { select: { name: true, code: true, code2: true } },
        },
      },
    },
  });

  // Round columns for live/final individual boards (overall, women, junior).
  // Prefer scoring-engine payload (includes discard flags); fall back to Score rows.
  const scoringRoundRows = await prisma.round.findMany({
    where: {
      competitionId: competition.id,
      type: 'OFFICIAL',
      status: {
        in: ['ACTIVE', 'PAUSED', 'CLOSED', 'PENDING_APPROVAL', 'APPROVED', 'LOCKED'],
      },
    },
    orderBy: { number: 'asc' },
    select: { id: true, number: true },
  });
  const roundNumbers = scoringRoundRows.map((r) => r.number);

  type PayloadRoundScore = {
    pilotId?: string;
    roundId?: string;
    roundNumber?: number;
    finalScoreCm?: number;
    isBullseye?: boolean;
    isDiscarded?: boolean;
    isProvisional?: boolean;
    resultType?: string;
  };
  type PayloadRanking = {
    pilotId?: string;
    roundScores?: PayloadRoundScore[];
  };

  const payloadRows = Array.isArray(result?.payloadJson)
    ? (result!.payloadJson as PayloadRanking[])
    : [];
  const scoresByPilotId = new Map<
    string,
    Array<{
      round: number;
      scoreCm: number | null;
      isBullseye: boolean;
      isDiscarded: boolean;
      isProvisional: boolean;
      resultType?: string;
    }>
  >();

  for (const row of payloadRows) {
    if (!row?.pilotId || !Array.isArray(row.roundScores)) continue;
    scoresByPilotId.set(
      row.pilotId,
      row.roundScores
        .filter((rs) => typeof rs.roundNumber === 'number')
        .map((rs) => {
          const provisional = Boolean(rs.isProvisional);
          // Hide live “max fill” placeholders so unfinished rounds look empty.
          const scoreCm =
            provisional || typeof rs.finalScoreCm !== 'number' ? null : rs.finalScoreCm;
          return {
            round: rs.roundNumber as number,
            scoreCm,
            isBullseye: Boolean(rs.isBullseye) && !provisional,
            isDiscarded: Boolean(rs.isDiscarded) && !provisional,
            isProvisional: provisional,
            resultType: rs.resultType,
          };
        })
        .sort((a, b) => a.round - b.round),
    );
  }

  // Fallback when result payload has no per-round detail (legacy recalculations).
  if (scoresByPilotId.size === 0 && rankings.length > 0 && scoringRoundRows.length > 0) {
    const pilotIds = rankings.map((r) => r.pilotId);
    const scoreRows = await prisma.score.findMany({
      where: {
        pilotId: { in: pilotIds },
        roundId: { in: scoringRoundRows.map((r) => r.id) },
        status: { in: ['ENTERED', 'CONFIRMED', 'APPROVED', 'LOCKED'] },
        finalScoreCm: { not: null },
      },
      select: {
        pilotId: true,
        roundId: true,
        finalScoreCm: true,
        isBullseye: true,
        isDiscarded: true,
        resultType: true,
      },
    });
    const roundNumberById = new Map(scoringRoundRows.map((r) => [r.id, r.number]));
    for (const s of scoreRows) {
      const round = roundNumberById.get(s.roundId);
      if (round == null) continue;
      const list = scoresByPilotId.get(s.pilotId) ?? [];
      list.push({
        round,
        scoreCm: s.finalScoreCm,
        isBullseye: s.isBullseye,
        isDiscarded: s.isDiscarded,
        isProvisional: false,
        resultType: s.resultType,
      });
      scoresByPilotId.set(s.pilotId, list);
    }
    for (const [pilotId, list] of scoresByPilotId) {
      scoresByPilotId.set(
        pilotId,
        list.sort((a, b) => a.round - b.round),
      );
    }
  }

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
            photoUrl: displayedPilotPhotoUrl(r.pilot),
            country: toPublicCountry(r.pilot.country),
            person: undefined,
          }
        : null,
      roundScores: scoresByPilotId.get(r.pilotId) ?? [],
    })),
    scoringRounds,
    roundNumbers,
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
          ...pilotPhotoWithPersonSelect,
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
    photoUrl: displayedPilotPhotoUrl(score.pilot),
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

export async function getPublicOfficials(slugOrId: string) {
  const competition = await getPublicCompetition(slugOrId);
  const rows = await prisma.competitionOfficial.findMany({
    where: { competitionId: competition.id, isPublic: true },
  });
  return rows
    .map((row) => ({
      id: row.id,
      competitionId: row.competitionId,
      name: row.name,
      role: row.role,
      imageUrl: row.imageUrl,
      phone: row.phone,
      email: row.email,
      displayOrder: row.displayOrder,
      isPublic: row.isPublic,
    }))
    .sort(compareOfficials);
}

export async function getPublicEventInfo(slugOrId: string) {
  const competition = await getPublicCompetition(slugOrId);
  const { getEventInfo } = await import('./competition-info.service.js');
  return getEventInfo(competition.id, { publicOnly: true });
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
      // Hide pending applications and rejections from public pilot lists
      status: { notIn: ['REGISTERED', 'REJECTED', 'WITHDRAWN', 'DISQUALIFIED', 'DNS'] },
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
      ...pilotPhotoWithPersonSelect,
      country: { select: { name: true, code: true, code2: true } },
    },
  });
  return {
    competitionId: competition.id,
    competitionName: competition.name,
    registrationOpen: PUBLIC_REGISTRATION_STATUSES.has(competition.status),
    pilots: pilots.map((p) => ({
      ...p,
      photoUrl: displayedPilotPhotoUrl(p),
      person: undefined,
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
  // Legacy unauthenticated path kept for API compatibility — prefer registerAuthenticatedPilot.
  return enrollPilotInCompetition(slugOrId, {
    firstName: input.firstName,
    lastName: input.lastName,
    gender: input.gender,
    countryCode: input.countryCode,
    nationality: input.nationality,
    faiLicense: input.faiLicense,
    civlId: input.civlId,
    club: input.club,
    dateOfBirth: input.dateOfBirth,
    glider: input.glider,
    harness: input.harness,
    emergencyContact: input.emergencyContact,
    emergencyPhone: input.emergencyPhone,
  });
}

/**
 * Login → Person profile → competition registration.
 * Uses the authenticated user's linked Person as identity; competition fields only.
 */
export async function registerAuthenticatedPilot(
  slugOrId: string,
  userId: string,
  input: {
    club?: string;
    glider?: string;
    harness?: string;
    emergencyContact?: string;
    emergencyPhone?: string;
    firstName?: string;
    lastName?: string;
    gender?: 'MALE' | 'FEMALE' | 'OTHER';
    countryCode?: string;
    nationality?: string;
    faiLicense?: string;
    civlId?: string;
    dateOfBirth?: string | Date;
  },
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== 'ACTIVE') {
    throw AppError.unauthorized();
  }

  let personId = user.personId;

  // Auto-link by verified login email if still unlinked
  if (!personId) {
    const byEmail = await prisma.person.findFirst({
      where: { email: user.email.toLowerCase(), status: 'ACTIVE' },
    });
    if (byEmail) {
      const clash = await prisma.user.findFirst({
        where: { personId: byEmail.id, NOT: { id: userId } },
      });
      if (!clash) {
        await prisma.user.update({
          where: { id: userId },
          data: { personId: byEmail.id },
        });
        personId = byEmail.id;
      }
    }
  }

  if (!personId) {
    const firstName = (input.firstName ?? user.firstName).trim();
    const lastName = (input.lastName ?? user.lastName).trim();
    if (!firstName || !lastName) {
      throw AppError.badRequest(
        'Complete your AeroJudge profile (first and last name) before registering',
      );
    }
    const { createPerson } = await import('./person.service.js');
    let countryId: string | undefined;
    if (input.countryCode) {
      countryId = (await resolveCountryId(input.countryCode)) ?? undefined;
    }
    const person = await createPerson(
      {
        firstName,
        lastName,
        gender: input.gender ?? 'MALE',
        email: user.email,
        civlId: input.civlId,
        faiLicenseNumber: input.faiLicense,
        nationalityCountryId: countryId ?? null,
        nationality: input.nationality,
        dateOfBirth: input.dateOfBirth ?? null,
        forceCreate: true,
      },
      { actorUserId: userId },
    );
    await prisma.person.update({
      where: { id: person.id },
      data: { emailVerifiedAt: new Date() },
    });
    await prisma.user.update({
      where: { id: userId },
      data: { personId: person.id },
    });
    personId = person.id;
  }

  const { getPerson } = await import('./person.service.js');
  const person = await getPerson(personId);

  return enrollPilotInCompetition(slugOrId, {
    personId,
    firstName: person.firstName,
    lastName: person.lastName,
    gender: person.gender,
    countryCode: input.countryCode,
    nationality: input.nationality ?? person.nationalityCountry?.name ?? undefined,
    countryId: person.nationalityCountryId ?? undefined,
    faiLicense: input.faiLicense ?? person.faiLicenseNumber ?? undefined,
    civlId: input.civlId ?? person.civlId ?? undefined,
    club: input.club,
    dateOfBirth: input.dateOfBirth ?? person.dateOfBirth ?? undefined,
    glider: input.glider,
    harness: input.harness,
    emergencyContact: input.emergencyContact,
    emergencyPhone: input.emergencyPhone,
  });
}

async function enrollPilotInCompetition(
  slugOrId: string,
  input: {
    personId?: string;
    firstName: string;
    lastName: string;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    countryCode?: string;
    nationality?: string;
    countryId?: string | null;
    faiLicense?: string;
    civlId?: string;
    club?: string;
    dateOfBirth?: string | Date | null;
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

  let countryId: string | undefined | null = input.countryId;
  let nationality = input.nationality;
  if (input.countryCode) {
    countryId = (await resolveCountryId(input.countryCode)) ?? undefined;
    if (!countryId) {
      throw AppError.badRequest(`Unknown country code: ${input.countryCode}`, 'INVALID_COUNTRY');
    }
    const country = await prisma.country.findUnique({ where: { id: countryId } });
    nationality = nationality ?? country?.name;
  } else if (nationality && !countryId) {
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

  const { createPilot } = await import('./pilot.service.js');
  const pilot = await createPilot(competition.id, {
    personId: input.personId,
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
    photoUrl: pilot.photoUrl,
    country: pilot.country,
    competitionId: competition.id,
    competitionName: competition.name,
    personId: pilot.personId,
    aeroJudgeId: pilot.person?.aeroJudgeId,
  };
}

/**
 * Authenticated pilot (or org staff via admin API) uploads headshot after registration.
 * Only the linked Person account for this pilot may use this public endpoint.
 */
export async function uploadOwnPilotPhoto(
  slugOrId: string,
  userId: string,
  pilotId: string,
  file: Express.Multer.File,
) {
  const competition = await getPublicCompetition(slugOrId);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { personId: true },
  });
  if (!user?.personId) {
    throw AppError.forbidden('Link an AeroJudge Person profile before uploading a photo');
  }

  const pilot = await prisma.pilot.findFirst({
    where: { id: pilotId, competitionId: competition.id },
    select: { id: true, personId: true },
  });
  if (!pilot) throw AppError.notFound('Pilot not found');
  if (pilot.personId !== user.personId) {
    throw AppError.forbidden('You can only upload a photo for your own registration');
  }

  const { uploadPilotPhoto } = await import('./pilot.service.js');
  const updated = await uploadPilotPhoto(competition.id, pilotId, file);
  return {
    id: updated.id,
    pilotNumber: updated.pilotNumber,
    firstName: updated.firstName,
    lastName: updated.lastName,
    photoUrl: updated.photoUrl,
  };
}

import { COMPETING_PILOT_STATUSES, compareOfficials, officialRoleLabel } from '@aero-judge/shared';
import { displayCountryCode, formatPilotName, formatScoreCm } from '@aero-judge/utils';
import { displayedPilotPhotoUrl } from './person.service.js';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { toAbsoluteAssetUrl } from '../utils/assets.js';
import { AppError } from '../utils/errors.js';
import {
  blogTitle,
  composeCompetitionBlog,
  plainTextFromHtml,
  toBlogSummary,
  type BlogBestScore,
  type BlogCountry,
  type BlogFigure,
  type BlogPhotoSource,
  type BlogPlace,
  type BlogRound,
  type CompetitionBlogArticle,
  type CompetitionBlogFacts,
  type CompetitionBlogSummary,
} from './blog-article.js';

const OFFICIAL_COUNTED_ROUND_STATUSES = ['CLOSED', 'PENDING_APPROVAL', 'APPROVED', 'LOCKED'] as const;
const PUBLIC_SCORE_STATUSES = ['ENTERED', 'CONFIRMED', 'APPROVED', 'LOCKED'] as const;

const publicStoryWhere = {
  status: 'COMPLETED' as const,
  isPublished: true,
  settings: { livePublicResults: true },
};

const storySelect = {
  id: true,
  name: true,
  organizer: true,
  venue: true,
  country: true,
  startDate: true,
  endDate: true,
  publicSlug: true,
  targetDiameterCm: true,
  settings: {
    select: {
      womenCategoryEnabled: true,
      maximumScoreCm: true,
      discardWorstRounds: true,
      discardAfterRounds: true,
      teamSize: true,
      teamScoringPilots: true,
      partnersLabel: true,
    },
  },
  _count: {
    select: {
      pilots: { where: { status: { in: [...COMPETING_PILOT_STATUSES] } } },
      teams: true,
      rounds: {
        where: {
          type: 'OFFICIAL' as const,
          status: { in: [...OFFICIAL_COUNTED_ROUND_STATUSES] },
        },
      },
    },
  },
};

type StoryRow = Awaited<ReturnType<typeof findStories>>[number];
type RankingRow = {
  rank: number;
  totalScoreCm: number;
  roundsFlown?: number;
  roundsScored?: number;
  bullseyes?: number;
};

/**
 * Public stories are derived from completed competitions that already publish
 * live results. Completing a competition makes the story available as soon as
 * those publication flags are on — including competitions completed earlier.
 */
export async function listCompetitionBlogSummaries(): Promise<CompetitionBlogSummary[]> {
  const rows = await findStories();
  if (rows.length === 0) return [];
  const winners = await prisma.individualRanking.findMany({
    where: {
      competitionId: { in: rows.map((row) => row.id) },
      category: 'OVERALL',
      rank: 1,
      roundsFlown: { gt: 0 },
    },
    include: { pilot: pilotStoryInclude },
  });
  const winnersByCompetition = new Map<string, BlogPlace[]>();
  for (const winner of winners) {
    const list = winnersByCompetition.get(winner.competitionId) ?? [];
    list.push(placeFromPilot(winner));
    winnersByCompetition.set(winner.competitionId, list);
  }
  return rows.map((row) =>
    toBlogSummary(
      composeCompetitionBlog(
        factsFromRow(row, { rankings: winnersByCompetition.get(row.id) ?? [] }),
      ),
    ),
  );
}

export async function getCompetitionBlog(slug: string): Promise<CompetitionBlogArticle> {
  const row = await prisma.competition.findFirst({
    where: {
      ...publicStoryWhere,
      OR: [{ publicSlug: slug }, { id: slug }],
    },
    select: storySelect,
  });
  if (!row) throw AppError.notFound('Competition story not found');

  const [overall, women, teams, pilots, rounds, info, partners, related, pictures, officials] = await Promise.all([
    prisma.individualRanking.findMany({
      where: { competitionId: row.id, category: 'OVERALL', roundsFlown: { gt: 0 } },
      orderBy: { rank: 'asc' },
      take: 10,
      include: { pilot: pilotStoryInclude },
    }),
    row.settings?.womenCategoryEnabled
      ? prisma.individualRanking.findMany({
          where: { competitionId: row.id, category: 'WOMEN', roundsFlown: { gt: 0 } },
          orderBy: { rank: 'asc' },
          take: 8,
          include: { pilot: pilotStoryInclude },
        })
      : Promise.resolve([]),
    prisma.teamRanking.findMany({
      where: { competitionId: row.id, roundsScored: { gt: 0 } },
      orderBy: { rank: 'asc' },
      include: { team: { include: { country: true } } },
    }),
    prisma.pilot.findMany({
      where: { competitionId: row.id, status: { in: [...COMPETING_PILOT_STATUSES] } },
      select: {
        nationality: true,
        gender: true,
        isWomen: true,
        country: { select: { name: true, code: true } },
      },
    }),
    loadRounds(row.id),
    prisma.competitionInfo.findUnique({
      where: { competitionId: row.id },
      select: { aboutHtml: true, flyingSiteHtml: true },
    }),
    prisma.sponsor.findMany({
      where: { competitionId: row.id, isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      take: 12,
      select: { name: true },
    }),
    prisma.competition.findMany({
      where: { ...publicStoryWhere, NOT: { id: row.id } },
      orderBy: { endDate: 'desc' },
      take: 4,
      select: { name: true, publicSlug: true },
    }),
    loadStoryPictures(row.id, row.name),
    prisma.competitionOfficial.findMany({
      where: { competitionId: row.id, isPublic: true },
      select: {
        name: true,
        role: true,
        imageUrl: true,
        displayOrder: true,
        person: { select: { aeroJudgeId: true, status: true } },
      },
    }),
  ]);

  const bestSingle = await loadBestScore(row.id);
  const publicSlug = row.publicSlug || row.id;

  return composeCompetitionBlog(
    factsFromRow(row, {
      rankings: overall.map((ranking) => withProfile(publicSlug, placeFromPilot(ranking), ranking.pilot)),
      womenRanking: women.map((ranking) => withProfile(publicSlug, placeFromPilot(ranking), ranking.pilot)),
      womenPilotCount: pilots.filter((pilot) => pilot.gender === 'FEMALE' || pilot.isWomen).length,
      womenCategoryEnabled: row.settings?.womenCategoryEnabled ?? false,
      teamRanking: preferredTeamRankings(teams).map((team) => ({
        place: team.rank,
        name: team.team.name,
        scoreCm: team.totalScoreCm,
        scoreLabel: scoreLabel(team.totalScoreCm),
        country: countryLabel(team.team.country, null),
        roundsFlown: team.roundsScored,
        bullseyes: 0,
        imageUrl: toAbsoluteAssetUrl(team.team.logoUrl) ?? '',
        profileUrl: '',
      })),
      countries: countriesFromPilots(pilots),
      officials: officials.sort(compareOfficials).map((official) => ({
        name: official.name.trim(),
        role: officialRoleLabel(official.role),
        imageUrl: toAbsoluteAssetUrl(official.imageUrl) ?? '',
        profileUrl:
          official.person?.status === 'ACTIVE'
            ? competitionProfileUrl(publicSlug, { aeroJudgeId: official.person.aeroJudgeId })
            : '',
      })),
      rounds,
      totalBullseyes: rounds.reduce((sum, round) => sum + round.bullseyes, 0),
      bestSingle,
      aboutParagraphs: plainTextFromHtml(info?.aboutHtml),
      flyingSiteParagraphs: plainTextFromHtml(info?.flyingSiteHtml),
      partnerNames: partners.map((partner) => partner.name.trim()).filter(Boolean),
      photos: pictures.photos,
      photoSource: pictures.source,
      related: related.map((item) => ({
        slug: item.publicSlug,
        title: blogTitle(item.name),
      })),
    }),
  );
}

function findStories() {
  return prisma.competition.findMany({
    where: publicStoryWhere,
    select: storySelect,
    orderBy: [{ endDate: 'desc' }, { name: 'asc' }],
    take: 200,
  });
}

async function loadRounds(competitionId: string): Promise<BlogRound[]> {
  const rounds = await prisma.round.findMany({
    where: {
      competitionId,
      type: 'OFFICIAL',
      status: { in: [...OFFICIAL_COUNTED_ROUND_STATUSES] },
    },
    orderBy: { number: 'asc' },
    select: { id: true, number: true, name: true, scheduledAt: true, closedAt: true },
  });
  if (rounds.length === 0) return [];
  const roundIds = rounds.map((round) => round.id);
  const [averages, bullseyes] = await Promise.all([
    prisma.score.groupBy({
      by: ['roundId'],
      where: {
        roundId: { in: roundIds },
        finalScoreCm: { not: null },
        status: { in: [...PUBLIC_SCORE_STATUSES] },
      },
      _avg: { finalScoreCm: true },
    }),
    prisma.score.groupBy({
      by: ['roundId'],
      where: {
        roundId: { in: roundIds },
        isBullseye: true,
        status: { in: [...PUBLIC_SCORE_STATUSES] },
      },
      _count: { _all: true },
    }),
  ]);
  const averageByRound = new Map(averages.map((row) => [row.roundId, row._avg.finalScoreCm]));
  const bullseyesByRound = new Map(bullseyes.map((row) => [row.roundId, row._count._all]));
  return rounds.map((round) => {
    const average = averageByRound.get(round.id);
    const name = round.name?.trim();
    return {
      number: round.number,
      label: name && name.toLowerCase() !== `round ${round.number}` ? name : `Round ${round.number}`,
      dateLabel: formatRoundDate(round.scheduledAt ?? round.closedAt),
      averageLabel: average == null ? '' : averageLabel(average),
      bullseyes: bullseyesByRound.get(round.id) ?? 0,
    };
  });
}

async function loadBestScore(competitionId: string): Promise<BlogBestScore | null> {
  const score = await prisma.score.findFirst({
    where: {
      finalScoreCm: { not: null },
      status: { in: [...PUBLIC_SCORE_STATUSES] },
      round: {
        competitionId,
        type: 'OFFICIAL',
        status: { in: [...OFFICIAL_COUNTED_ROUND_STATUSES] },
      },
    },
    orderBy: [{ finalScoreCm: 'asc' }, { id: 'asc' }],
    select: {
      finalScoreCm: true,
      round: { select: { number: true } },
      pilot: { select: { firstName: true, lastName: true } },
    },
  });
  if (!score || score.finalScoreCm == null) return null;
  return {
    name: formatPilotName(score.pilot.firstName, score.pilot.lastName),
    scoreCm: score.finalScoreCm,
    scoreLabel: scoreLabel(score.finalScoreCm),
    roundNumber: score.round.number,
  };
}

function factsFromRow(
  row: StoryRow,
  extra: Partial<CompetitionBlogFacts> = {},
): CompetitionBlogFacts {
  const slug = row.publicSlug || row.id;
  const base = publicResultsBase();
  return {
    name: row.name,
    slug,
    organizer: row.organizer,
    venue: row.venue,
    country: row.country,
    startDate: row.startDate,
    endDate: row.endDate,
    pilotCount: row._count.pilots,
    teamCount: row._count.teams,
    officialRoundCount: row._count.rounds,
    rankings: [],
    womenRanking: [],
    womenPilotCount: 0,
    womenCategoryEnabled: row.settings?.womenCategoryEnabled ?? false,
    teamRanking: [],
    officials: [],
    countries: [],
    rounds: [],
    totalBullseyes: 0,
    bestSingle: null,
    scoring: row.settings
      ? {
          maximumScoreCm: row.settings.maximumScoreCm,
          discardWorstRounds: row.settings.discardWorstRounds,
          discardAfterRounds: row.settings.discardAfterRounds,
          targetDiameterCm: row.targetDiameterCm,
          teamSize: row.settings.teamSize,
          teamScoringPilots: row.settings.teamScoringPilots,
        }
      : null,
    aboutParagraphs: [],
    flyingSiteParagraphs: [],
    partnersLabel: row.settings?.partnersLabel?.trim() || 'Partners',
    partnerNames: [],
    photos: [],
    photoSource: 'none',
    related: [],
    resultsUrl: `${base}/competition/${encodeURIComponent(slug)}/results`,
    womenUrl: `${base}/competition/${encodeURIComponent(slug)}/women`,
    teamsUrl: `${base}/competition/${encodeURIComponent(slug)}/teams`,
    ...extra,
  };
}

const pilotStoryInclude = {
  include: {
    country: true,
    person: { select: { photoUrl: true, aeroJudgeId: true, status: true } },
  },
} as const;

async function loadStoryPictures(
  competitionId: string,
  competitionName: string,
): Promise<{ photos: BlogFigure[]; source: BlogPhotoSource }> {
  const [feed, gallery] = await Promise.all([
    prisma.eventFeedItem.findMany({
      where: { competitionId, kind: 'PHOTO', imageUrl: { not: null } },
      orderBy: { createdAt: 'asc' },
      take: 12,
      select: { imageUrl: true, caption: true },
    }),
    prisma.competitionGalleryImage.findMany({
      where: { competitionId },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      take: 12,
      select: { url: true, caption: true },
    }),
  ]);

  const seen = new Set<string>();
  const photos: BlogFigure[] = [];
  let fromFeed = 0;
  let fromGallery = 0;
  const push = (raw: string | null, caption: string | null, source: 'feed' | 'gallery') => {
    const src = toAbsoluteAssetUrl(raw);
    if (!src || !/^https?:\/\//i.test(src) || seen.has(src) || photos.length >= 12) return;
    seen.add(src);
    const text = caption?.trim() || `Photo from ${competitionName}`;
    photos.push({ src, alt: text, caption: text });
    if (source === 'feed') fromFeed += 1;
    else fromGallery += 1;
  };
  for (const item of feed) push(item.imageUrl, item.caption, 'feed');
  for (const item of gallery) push(item.url, item.caption, 'gallery');

  const source: BlogPhotoSource =
    fromFeed > 0 && fromGallery > 0 ? 'both' : fromFeed > 0 ? 'feed' : fromGallery > 0 ? 'gallery' : 'none';
  return { photos, source };
}

function preferredTeamRankings<T extends { category: string }>(rows: T[]): T[] {
  const category = rows.some((row) => row.category === 'TEAM') ? 'TEAM' : 'OVERALL';
  return rows.filter((row) => row.category === category).slice(0, 8);
}

function countriesFromPilots(
  pilots: Array<{
    nationality: string | null;
    country: { name: string; code: string } | null;
  }>,
): BlogCountry[] {
  const counts = new Map<string, number>();
  for (const pilot of pilots) {
    const name = countryLabel(pilot.country, pilot.nationality);
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, pilotCount]) => ({ name, pilotCount }))
    .sort((a, b) => b.pilotCount - a.pilotCount || a.name.localeCompare(b.name));
}

function placeFromPilot(row: RankingRow & {
  pilot: {
    firstName: string;
    lastName: string;
    nationality: string | null;
    photoUrl?: string | null;
    person?: { photoUrl?: string | null } | null;
    country: { name: string; code: string } | null;
  };
}): BlogPlace {
  return {
    place: row.rank,
    name: formatPilotName(row.pilot.firstName, row.pilot.lastName),
    scoreCm: row.totalScoreCm,
    scoreLabel: scoreLabel(row.totalScoreCm),
    country: countryLabel(row.pilot.country, row.pilot.nationality),
    roundsFlown: row.roundsFlown ?? row.roundsScored ?? 0,
    bullseyes: row.bullseyes ?? 0,
    imageUrl: toAbsoluteAssetUrl(displayedPilotPhotoUrl(row.pilot)) ?? '',
    profileUrl: '',
  };
}

function withProfile(
  slug: string,
  place: BlogPlace,
  pilot: {
    pilotNumber: number | null;
    person?: { aeroJudgeId: string; status: string } | null;
  },
): BlogPlace {
  return {
    ...place,
    profileUrl: competitionProfileUrl(slug, {
      pilotNumber: pilot.pilotNumber,
      aeroJudgeId: pilot.person?.status === 'ACTIVE' ? pilot.person.aeroJudgeId : null,
    }),
  };
}

function competitionProfileUrl(
  slug: string,
  identity: { pilotNumber?: number | null; aeroJudgeId?: string | null },
): string {
  const base = `${publicResultsBase()}/competition/${encodeURIComponent(slug)}`;
  if (identity.pilotNumber != null) return `${base}/pilots/${identity.pilotNumber}`;
  if (identity.aeroJudgeId) return `${base}/profile/${encodeURIComponent(identity.aeroJudgeId)}`;
  return '';
}

function countryLabel(
  country: { name: string; code: string } | null | undefined,
  nationality: string | null | undefined,
): string {
  const name = country?.name?.trim();
  if (name) return name;
  return displayCountryCode(country, nationality);
}

function scoreLabel(scoreCm: number): string {
  return `${formatScoreCm(scoreCm)} cm`;
}

function averageLabel(scoreCm: number): string {
  const rounded = Math.round(scoreCm * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text} cm`;
}

function formatRoundDate(value: Date | null): string {
  if (!value) return '';
  try {
    return value.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

function publicResultsBase(): string {
  return env.PUBLIC_RESULTS_URL.replace(/\/+$/, '');
}

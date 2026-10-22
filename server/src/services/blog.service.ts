import { COMPETING_PILOT_STATUSES } from '@aero-judge/shared';
import { displayCountryCode, formatPilotName, formatScoreCm } from '@aero-judge/utils';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import {
  composeCompetitionBlog,
  toBlogSummary,
  type BlogPlace,
  type CompetitionBlogArticle,
  type CompetitionBlogFacts,
  type CompetitionBlogSummary,
} from './blog-article.js';

const OFFICIAL_COUNTED_ROUND_STATUSES = ['CLOSED', 'PENDING_APPROVAL', 'APPROVED', 'LOCKED'] as const;

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
  settings: { select: { womenCategoryEnabled: true } },
  _count: {
    select: {
      pilots: { where: { status: { in: [...COMPETING_PILOT_STATUSES] } } },
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

/**
 * Public stories are derived from completed competitions that already publish
 * live results. Completing a competition makes the story available as soon as
 * those publication flags are on — including competitions completed earlier.
 */
export async function listCompetitionBlogSummaries(): Promise<CompetitionBlogSummary[]> {
  const rows = await findStories();
  return rows.map((row) => toBlogSummary(composeCompetitionBlog(factsFromRow(row, [], null, null))));
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

  const [podiumRows, womenRow, teamRow] = await Promise.all([
    prisma.individualRanking.findMany({
      where: { competitionId: row.id, category: 'OVERALL', roundsFlown: { gt: 0 } },
      orderBy: { rank: 'asc' },
      take: 3,
      include: { pilot: { include: { country: true } } },
    }),
    row.settings?.womenCategoryEnabled
      ? prisma.individualRanking.findFirst({
          where: { competitionId: row.id, category: 'WOMEN', roundsFlown: { gt: 0 } },
          orderBy: { rank: 'asc' },
          include: { pilot: { include: { country: true } } },
        })
      : Promise.resolve(null),
    prisma.teamRanking.findFirst({
      where: { competitionId: row.id, category: 'OVERALL', roundsScored: { gt: 0 } },
      orderBy: { rank: 'asc' },
      include: { team: { include: { country: true } } },
    }),
  ]);

  return composeCompetitionBlog(
    factsFromRow(
      row,
      podiumRows.map(placeFromPilot),
      womenRow ? placeFromPilot(womenRow) : null,
      teamRow
        ? {
            place: teamRow.rank,
            name: teamRow.team.name,
            scoreLabel: scoreLabel(teamRow.totalScoreCm),
            country: countryLabel(teamRow.team.country, null),
          }
        : null,
    ),
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

function factsFromRow(
  row: StoryRow,
  podium: BlogPlace[],
  womenWinner: BlogPlace | null,
  teamWinner: BlogPlace | null,
): CompetitionBlogFacts {
  const slug = row.publicSlug || row.id;
  return {
    name: row.name,
    slug,
    organizer: row.organizer,
    venue: row.venue,
    country: row.country,
    startDate: row.startDate,
    endDate: row.endDate,
    pilotCount: row._count.pilots,
    officialRoundCount: row._count.rounds,
    podium,
    womenWinner,
    teamWinner,
    resultsUrl: `${env.PUBLIC_RESULTS_URL.replace(/\/+$/, '')}/competition/${encodeURIComponent(slug)}/results`,
  };
}

function placeFromPilot(row: {
  rank: number;
  totalScoreCm: number;
  pilot: {
    firstName: string;
    lastName: string;
    nationality: string | null;
    country: { name: string; code: string } | null;
  };
}): BlogPlace {
  return {
    place: row.rank,
    name: formatPilotName(row.pilot.firstName, row.pilot.lastName),
    scoreLabel: scoreLabel(row.totalScoreCm),
    country: countryLabel(row.pilot.country, row.pilot.nationality),
  };
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

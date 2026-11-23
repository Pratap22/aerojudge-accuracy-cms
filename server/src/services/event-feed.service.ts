import { unlink } from 'node:fs/promises';
import type { ScoreResultType } from '@aero-judge/shared';
import {
  feedRankingCaption,
  formatScoreCm,
  placeLabel,
  type FeedRankingBoard,
} from '@aero-judge/utils';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { resolveLocalUploadPath, toAbsoluteAssetUrl } from '../utils/assets.js';
import { destroyCloudinaryImage, uploadImageToCloudinary } from '../utils/cloudinary.js';
import { prepareFeedPhoto } from '../utils/feed-photo.js';
import { displayedPilotPhotoUrl } from './person.service.js';
import { emitFeedUpdated } from '../socket/index.js';

const FEED_LIMIT = 100;
const TEXT_MAX = 1000;

export type EventFeedKind = 'SCORE' | 'REFLIGHT' | 'PHOTO' | 'TEXT';

export interface EventFeedItemDto {
  id: string;
  kind: EventFeedKind;
  pilotNumber: number | null;
  pilotName: string | null;
  pilotPhotoUrl: string | null;
  roundNumber: number | null;
  scoreText: string | null;
  reason: string | null;
  caption: string | null;
  imageUrl: string | null;
  body: string;
  createdAt: string;
}

type FeedRow = {
  id: string;
  kind: EventFeedKind;
  pilotNumber: number | null;
  pilotName: string | null;
  pilotPhotoUrl: string | null;
  roundNumber: number | null;
  scoreText: string | null;
  reason: string | null;
  caption: string | null;
  imageUrl: string | null;
  body: string;
  updatedAt: Date;
};

const feedSelect = {
  id: true,
  kind: true,
  pilotNumber: true,
  pilotName: true,
  pilotPhotoUrl: true,
  roundNumber: true,
  scoreText: true,
  reason: true,
  caption: true,
  imageUrl: true,
  body: true,
  updatedAt: true,
} as const;

function mapItem(row: FeedRow): EventFeedItemDto {
  return {
    id: row.id,
    kind: row.kind,
    pilotNumber: row.pilotNumber,
    pilotName: row.pilotName,
    pilotPhotoUrl: row.pilotPhotoUrl,
    roundNumber: row.roundNumber,
    scoreText: row.scoreText,
    reason: row.reason,
    caption: row.caption,
    imageUrl: row.imageUrl,
    body: row.body,
    createdAt: row.updatedAt.toISOString(),
  };
}

function pilotLabel(pilotNumber: number | null): string {
  if (pilotNumber == null) return 'Pilot';
  return `Pilot ${String(pilotNumber).padStart(3, '0')}`;
}

function pilotDisplayName(pilot: { firstName: string; lastName: string }): string {
  return `${pilot.firstName} ${pilot.lastName}`.trim();
}

async function loadPilot(competitionId: string, pilotId: string) {
  const pilot = await prisma.pilot.findFirst({
    where: { id: pilotId, competitionId },
    select: {
      id: true,
      pilotNumber: true,
      firstName: true,
      lastName: true,
      photoUrl: true,
      person: { select: { photoUrl: true } },
    },
  });
  if (!pilot) throw AppError.notFound('Pilot not found');
  return pilot;
}

function pilotPhoto(pilot: {
  photoUrl?: string | null;
  person?: { photoUrl?: string | null } | null;
}): string | null {
  return toAbsoluteAssetUrl(displayedPilotPhotoUrl(pilot));
}

export function describeEnteredScore(input: {
  resultType: ScoreResultType;
  finalScoreCm: number | null;
  isBullseye: boolean;
}): string {
  if (input.resultType === 'REFLIGHT') return 'Reflight';
  const cm = `${formatScoreCm(input.finalScoreCm ?? 0)} cm`;
  if (input.resultType === 'BULLSEYE' || input.isBullseye) return `${cm} bullseye`;
  if (input.resultType === 'MEASURED' || input.resultType === 'PENALTY' || input.resultType === 'MAXIMUM') {
    return cm;
  }
  return `${input.resultType} · ${cm}`;
}

export async function listFeed(competitionId: string): Promise<EventFeedItemDto[]> {
  const items = await prisma.eventFeedItem.findMany({
    where: { competitionId },
    orderBy: { updatedAt: 'desc' },
    take: FEED_LIMIT,
    select: feedSelect,
  });
  return items.map(mapItem);
}

export async function createTextPost(
  competitionId: string,
  createdById: string | undefined,
  input: { body: string },
): Promise<EventFeedItemDto> {
  const body = input.body.trim();
  if (!body) throw AppError.badRequest('Text is required');
  if (body.length > TEXT_MAX) throw AppError.badRequest(`Text must be ${TEXT_MAX} characters or fewer`);

  const row = await prisma.eventFeedItem.create({
    data: {
      competitionId,
      kind: 'TEXT',
      body,
      createdById: createdById ?? null,
    },
    select: feedSelect,
  });
  emitFeedUpdated(competitionId);
  return mapItem(row);
}

export async function createScorePost(
  competitionId: string,
  createdById: string | undefined,
  input: { pilotId: string; scoreText: string },
): Promise<EventFeedItemDto> {
  const scoreText = input.scoreText.trim();
  if (!scoreText) throw AppError.badRequest('Score is required');
  if (scoreText.length > 120) throw AppError.badRequest('Score must be 120 characters or fewer');

  const pilot = await loadPilot(competitionId, input.pilotId);
  const name = pilotDisplayName(pilot);
  const row = await prisma.eventFeedItem.create({
    data: {
      competitionId,
      kind: 'SCORE',
      pilotId: pilot.id,
      pilotNumber: pilot.pilotNumber,
      pilotName: name,
      pilotPhotoUrl: pilotPhoto(pilot),
      scoreText,
      body: `${pilotLabel(pilot.pilotNumber)} ${name} scored ${scoreText}`,
      createdById: createdById ?? null,
    },
    select: feedSelect,
  });
  emitFeedUpdated(competitionId);
  return mapItem(row);
}

export async function createPhotoPost(
  competitionId: string,
  createdById: string | undefined,
  file: Express.Multer.File,
  caption: string,
): Promise<EventFeedItemDto> {
  const text = caption.trim();
  if (!text) throw AppError.badRequest('Caption is required');
  if (text.length > TEXT_MAX) throw AppError.badRequest(`Caption must be ${TEXT_MAX} characters or fewer`);

  const photo = await prepareFeedPhoto(file);

  const uploaded = await uploadImageToCloudinary(photo, {
    folder: `feed/${competitionId}`,
    maxEdge: 2000,
  });

  const row = await prisma.eventFeedItem.create({
    data: {
      competitionId,
      kind: 'PHOTO',
      caption: text,
      imageUrl: uploaded.url,
      body: text,
      createdById: createdById ?? null,
    },
    select: feedSelect,
  });
  emitFeedUpdated(competitionId);
  return mapItem(row);
}

export interface RankingStandingRow {
  id: string;
  rank: number;
  name: string;
  pilotNumber: number | null;
  teamName: string | null;
  scoreText: string;
  countryCode: string | null;
  photoUrl: string | null;
}

function scoreLabel(cm: number): string {
  return `${formatScoreCm(cm)} cm`;
}

function usableCountry(code2: string | null | undefined): string | null {
  const code = code2?.trim().toUpperCase() ?? '';
  if (!/^[A-Z]{2}$/.test(code) || code === 'XX') return null;
  return code;
}

function teamNames(names: Array<string | null | undefined>): string | null {
  const unique = [...new Set(names.map((name) => name?.trim() ?? '').filter(Boolean))];
  return unique.length > 0 ? unique.join(', ') : null;
}

const standingPilotSelect = {
  id: true,
  pilotNumber: true,
  firstName: true,
  lastName: true,
  photoUrl: true,
  country: { select: { code2: true } },
  person: { select: { photoUrl: true } },
  teamMembers: {
    orderBy: { createdAt: 'asc' as const },
    select: { team: { select: { name: true } } },
  },
};

async function assertCompetitionCompleted(competitionId: string): Promise<void> {
  const competition = await prisma.competition.findUnique({
    where: { id: competitionId },
    select: { status: true },
  });
  if (!competition) throw AppError.notFound('Competition not found');
  if (competition.status !== 'COMPLETED') {
    throw AppError.badRequest('Result posts are available once the competition is completed');
  }
}

export async function listRankingStandings(competitionId: string): Promise<{
  overall: RankingStandingRow[];
  team: RankingStandingRow[];
}> {
  await assertCompetitionCompleted(competitionId);
  const [overallRows, teamRows] = await Promise.all([
    prisma.individualRanking.findMany({
      where: { competitionId, category: 'OVERALL', roundsFlown: { gt: 0 } },
      orderBy: [{ rank: 'asc' }, { pilot: { lastName: 'asc' } }],
      include: { pilot: { select: standingPilotSelect } },
    }),
    prisma.teamRanking.findMany({
      where: { competitionId, roundsScored: { gt: 0 } },
      orderBy: [{ rank: 'asc' }, { team: { name: 'asc' } }],
      include: {
        team: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            country: { select: { code2: true } },
          },
        },
      },
    }),
  ]);

  const teamList = teamRows.some((row) => row.category === 'TEAM')
    ? teamRows.filter((row) => row.category === 'TEAM')
    : teamRows;

  return {
    overall: overallRows.map((row) => ({
      id: row.pilotId,
      rank: row.rank,
      name: pilotDisplayName(row.pilot),
      pilotNumber: row.pilot.pilotNumber,
      teamName: teamNames(row.pilot.teamMembers.map((member) => member.team.name)),
      scoreText: scoreLabel(row.totalScoreCm),
      countryCode: usableCountry(row.pilot.country?.code2),
      photoUrl: pilotPhoto(row.pilot),
    })),
    team: teamList.map((row) => ({
      id: row.teamId,
      rank: row.rank,
      name: row.team.name,
      pilotNumber: null,
      teamName: row.team.name,
      scoreText: scoreLabel(row.totalScoreCm),
      countryCode: usableCountry(row.team.country?.code2),
      photoUrl: toAbsoluteAssetUrl(row.team.logoUrl),
    })),
  };
}

/**
 * Push one current overall or team place onto the feed.
 * Posting the same pilot or team again refreshes that card and moves it to the top.
 */
export async function createRankingPost(
  competitionId: string,
  createdById: string | undefined,
  input: { board: FeedRankingBoard; id: string },
): Promise<EventFeedItemDto> {
  await assertCompetitionCompleted(competitionId);
  if (input.board === 'OVERALL') {
    const ranking = await prisma.individualRanking.findFirst({
      where: {
        competitionId,
        category: 'OVERALL',
        pilotId: input.id,
        roundsFlown: { gt: 0 },
      },
      include: { pilot: { select: standingPilotSelect } },
    });
    if (!ranking) throw AppError.notFound('That pilot is not on the overall list');

    const name = pilotDisplayName(ranking.pilot);
    const teamName = teamNames(ranking.pilot.teamMembers.map((member) => member.team.name));
    const countryCode = usableCountry(ranking.pilot.country?.code2);
    const scoreText = scoreLabel(ranking.totalScoreCm);
    const photo = pilotPhoto(ranking.pilot);
    const place = placeLabel(ranking.rank);
    const body = teamName
      ? `${place} overall — ${name}, ${teamName}, ${scoreText}`
      : `${place} overall — ${name}, ${scoreText}`;
    return saveRankingPost({
      competitionId,
      createdById,
      sourceKey: `ranking:OVERALL:${ranking.pilotId}`,
      pilotId: ranking.pilot.id,
      pilotNumber: ranking.pilot.pilotNumber,
      pilotName: name,
      photo,
      rank: ranking.rank,
      scoreText,
      teamName,
      countryCode,
      board: 'OVERALL',
      body,
    });
  }

  const matches = await prisma.teamRanking.findMany({
    where: { competitionId, teamId: input.id, roundsScored: { gt: 0 } },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
          country: { select: { code2: true } },
        },
      },
    },
  });
  const ranking = matches.find((row) => row.category === 'TEAM') ?? matches[0];
  if (!ranking) throw AppError.notFound('That team is not on the team list');

  const countryCode = usableCountry(ranking.team.country?.code2);
  const scoreText = scoreLabel(ranking.totalScoreCm);
  const photo = toAbsoluteAssetUrl(ranking.team.logoUrl);
  const place = placeLabel(ranking.rank);
  return saveRankingPost({
    competitionId,
    createdById,
    sourceKey: `ranking:TEAM:${ranking.teamId}`,
    pilotId: null,
    pilotNumber: null,
    pilotName: ranking.team.name,
    photo,
    rank: ranking.rank,
    scoreText,
    teamName: null,
    countryCode,
    board: 'TEAM',
    body: `${place} team — ${ranking.team.name}, ${scoreText}`,
  });
}

async function saveRankingPost(input: {
  competitionId: string;
  createdById: string | undefined;
  sourceKey: string;
  pilotId: string | null;
  pilotNumber: number | null;
  pilotName: string;
  photo: string | null;
  rank: number;
  scoreText: string;
  teamName: string | null;
  countryCode: string | null;
  board: FeedRankingBoard;
  body: string;
}): Promise<EventFeedItemDto> {
  const data = {
    kind: 'SCORE' as const,
    pilotId: input.pilotId,
    pilotNumber: input.pilotNumber,
    pilotName: input.pilotName,
    pilotPhotoUrl: input.photo,
    imageUrl: input.photo,
    roundNumber: input.rank,
    scoreText: input.scoreText,
    reason: input.teamName,
    caption: feedRankingCaption(input.board, input.countryCode),
    body: input.body,
    createdById: input.createdById ?? null,
  };
  const row = await prisma.eventFeedItem.upsert({
    where: {
      competitionId_sourceKey: {
        competitionId: input.competitionId,
        sourceKey: input.sourceKey,
      },
    },
    create: {
      competitionId: input.competitionId,
      sourceKey: input.sourceKey,
      ...data,
    },
    update: data,
    select: feedSelect,
  });
  emitFeedUpdated(input.competitionId);
  return mapItem(row);
}

/** Drop score or reflight cards that were created from scoring, not written by hand. */
export async function removeAutoFeedPosts(
  competitionId: string,
  kinds: Array<'SCORE' | 'REFLIGHT'>,
): Promise<void> {
  if (kinds.length === 0) return;
  const removed = await prisma.eventFeedItem.deleteMany({
    where: {
      competitionId,
      kind: { in: kinds },
      sourceKey: { not: null },
    },
  });
  if (removed.count > 0) emitFeedUpdated(competitionId);
}

/**
 * Publish or refresh the feed card for a score just entered on a flight.
 * A later correction for the same flight updates this card instead of adding another.
 */
export async function publishEnteredScore(input: {
  competitionId: string;
  flightId: string;
  roundNumber: number;
  pilotId: string;
  createdById?: string;
  resultType: ScoreResultType;
  finalScoreCm: number | null;
  isBullseye: boolean;
  judgeNotes?: string | null;
}): Promise<void> {
  const isReflight = input.resultType === 'REFLIGHT';
  const settings = await prisma.competitionSettings.findUnique({
    where: { competitionId: input.competitionId },
    select: { feedPublishScores: true, feedPublishReflights: true },
  });
  const publish = isReflight ? settings?.feedPublishReflights : settings?.feedPublishScores;
  if (publish === false) {
    const removed = await prisma.eventFeedItem.deleteMany({
      where: {
        competitionId: input.competitionId,
        sourceKey: `flight:${input.flightId}`,
      },
    });
    if (removed.count > 0) emitFeedUpdated(input.competitionId);
    return;
  }

  const pilot = await loadPilot(input.competitionId, input.pilotId);
  const name = pilotDisplayName(pilot);
  const label = pilotLabel(pilot.pilotNumber);
  const reason = isReflight ? input.judgeNotes?.trim() || 'Reflight' : null;
  const scoreText = isReflight
    ? null
    : describeEnteredScore({
        resultType: input.resultType,
        finalScoreCm: input.finalScoreCm,
        isBullseye: input.isBullseye,
      });
  const body = isReflight
    ? `${label} ${name} reflight — ${reason}`
    : `${label} ${name} scored ${scoreText}`;
  const sourceKey = `flight:${input.flightId}`;
  const now = new Date();

  await prisma.eventFeedItem.upsert({
    where: {
      competitionId_sourceKey: {
        competitionId: input.competitionId,
        sourceKey,
      },
    },
    create: {
      competitionId: input.competitionId,
      kind: isReflight ? 'REFLIGHT' : 'SCORE',
      pilotId: pilot.id,
      pilotNumber: pilot.pilotNumber,
      pilotName: name,
      pilotPhotoUrl: pilotPhoto(pilot),
      roundNumber: input.roundNumber,
      scoreText,
      reason,
      body,
      sourceKey,
      createdById: input.createdById ?? null,
    },
    update: {
      kind: isReflight ? 'REFLIGHT' : 'SCORE',
      pilotId: pilot.id,
      pilotNumber: pilot.pilotNumber,
      pilotName: name,
      pilotPhotoUrl: pilotPhoto(pilot),
      roundNumber: input.roundNumber,
      scoreText,
      reason,
      body,
      createdById: input.createdById ?? null,
      createdAt: now,
    },
  });
  emitFeedUpdated(input.competitionId);
}

export async function deleteFeedItem(competitionId: string, itemId: string): Promise<void> {
  const existing = await prisma.eventFeedItem.findFirst({
    where: { id: itemId, competitionId },
    select: { id: true, imageUrl: true, kind: true },
  });
  if (!existing) throw AppError.notFound('Feed item not found');

  await prisma.eventFeedItem.delete({ where: { id: existing.id } });
  if (existing.kind === 'PHOTO' && existing.imageUrl) {
    const localPath = resolveLocalUploadPath(existing.imageUrl);
    if (localPath) {
      await unlink(localPath).catch(() => undefined);
    } else {
      await destroyCloudinaryImage(existing.imageUrl);
    }
  }
  emitFeedUpdated(competitionId);
}

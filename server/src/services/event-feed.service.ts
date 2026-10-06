import { unlink } from 'node:fs/promises';
import type { ScoreResultType } from '@aero-judge/shared';
import { formatScoreCm } from '@aero-judge/utils';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { resolveLocalUploadPath, toAbsoluteAssetUrl } from '../utils/assets.js';
import { destroyCloudinaryImage, uploadImageToCloudinary } from '../utils/cloudinary.js';
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

  const allowed = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowed.includes(file.mimetype)) {
    throw AppError.badRequest('Photo must be PNG, JPEG, or WebP');
  }

  const uploaded = await uploadImageToCloudinary(file, {
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
  const pilot = await loadPilot(input.competitionId, input.pilotId);
  const name = pilotDisplayName(pilot);
  const label = pilotLabel(pilot.pilotNumber);
  const isReflight = input.resultType === 'REFLIGHT';
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

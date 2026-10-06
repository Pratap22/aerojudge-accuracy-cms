import type { CreateProtestInput, UpdateProtestInput } from '@aero-judge/shared';
import { formatPilotName } from '@aero-judge/utils';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import {
  destroyCloudinaryAsset,
  fetchStoredCloudinaryFile,
  uploadDocumentToCloudinary,
} from '../utils/cloudinary.js';
import { getCompetition } from './competition.service.js';

function mapProtest(row: {
  id: string;
  competitionId: string;
  pilotId: string | null;
  pilotNumber: number;
  pilotName: string;
  reason: string;
  outcome: string;
  formUrl: string | null;
  formFileName: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    competitionId: row.competitionId,
    pilotId: row.pilotId,
    pilotNumber: row.pilotNumber,
    pilotName: row.pilotName,
    reason: row.reason,
    outcome: row.outcome,
    formUrl: row.formUrl,
    formFileName: row.formFileName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function pilotForNumber(competitionId: string, pilotNumber: number) {
  const pilot = await prisma.pilot.findUnique({
    where: { competitionId_pilotNumber: { competitionId, pilotNumber } },
    select: { id: true, pilotNumber: true, firstName: true, lastName: true },
  });
  if (!pilot) {
    throw AppError.badRequest(`No pilot with number ${pilotNumber} is registered in this competition`);
  }
  return pilot;
}

export async function listProtests(competitionId: string) {
  await getCompetition(competitionId);
  const rows = await prisma.protest.findMany({
    where: { competitionId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(mapProtest);
}

export async function getProtest(competitionId: string, protestId: string) {
  const row = await prisma.protest.findFirst({
    where: { id: protestId, competitionId },
  });
  if (!row) throw AppError.notFound('Protest not found');
  return mapProtest(row);
}

export async function createProtest(
  competitionId: string,
  input: CreateProtestInput,
  opts?: { actorUserId?: string },
) {
  await getCompetition(competitionId);
  const pilot = await pilotForNumber(competitionId, input.pilotNumber);
  const row = await prisma.protest.create({
    data: {
      competitionId,
      pilotId: pilot.id,
      pilotNumber: pilot.pilotNumber,
      pilotName: formatPilotName(pilot.firstName, pilot.lastName),
      reason: input.reason.trim(),
      outcome: input.outcome.trim(),
      createdById: opts?.actorUserId,
    },
  });
  return mapProtest(row);
}

export async function updateProtest(
  competitionId: string,
  protestId: string,
  input: UpdateProtestInput,
) {
  await getProtest(competitionId, protestId);
  const pilot =
    input.pilotNumber != null ? await pilotForNumber(competitionId, input.pilotNumber) : null;
  const row = await prisma.protest.update({
    where: { id: protestId },
    data: {
      ...(pilot
        ? {
            pilotId: pilot.id,
            pilotNumber: pilot.pilotNumber,
            pilotName: formatPilotName(pilot.firstName, pilot.lastName),
          }
        : {}),
      ...(input.reason != null ? { reason: input.reason.trim() } : {}),
      ...(input.outcome != null ? { outcome: input.outcome.trim() } : {}),
    },
  });
  return mapProtest(row);
}

export async function deleteProtest(competitionId: string, protestId: string) {
  const existing = await prisma.protest.findFirst({
    where: { id: protestId, competitionId },
  });
  if (!existing) throw AppError.notFound('Protest not found');
  await prisma.protest.delete({ where: { id: protestId } });
  await destroyCloudinaryAsset(existing.formUrl);
  return { deleted: true };
}

export async function uploadProtestForm(
  competitionId: string,
  protestId: string,
  file: Express.Multer.File,
) {
  const existing = await getProtest(competitionId, protestId);
  const { url } = await uploadDocumentToCloudinary(file, {
    folder: `protests/${competitionId}`,
    publicId: protestId,
  });
  const row = await prisma.protest.update({
    where: { id: protestId },
    data: {
      formUrl: url,
      formFileName: file.originalname?.slice(0, 200) || null,
    },
  });
  if (existing.formUrl && existing.formUrl !== url) {
    await destroyCloudinaryAsset(existing.formUrl);
  }
  return mapProtest(row);
}

export async function readProtestForm(competitionId: string, protestId: string) {
  const protest = await getProtest(competitionId, protestId);
  if (!protest.formUrl) throw AppError.notFound('No signed form is attached');
  const file = await fetchStoredCloudinaryFile(protest.formUrl);
  return {
    ...file,
    filename: protest.formFileName?.trim() || 'signed-form',
  };
}

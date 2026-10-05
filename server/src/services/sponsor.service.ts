import { unlink } from 'node:fs/promises';
import type { CreateSponsorInput, UpdateSponsorInput } from '@aero-judge/shared';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { resolveLocalUploadPath, toAbsoluteAssetUrl } from '../utils/assets.js';
import { destroyCloudinaryImage, uploadImageToCloudinary } from '../utils/cloudinary.js';
import { getCompetition } from './competition.service.js';

function mapSponsor(row: {
  id: string;
  competitionId: string;
  name: string;
  tier: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  displayOrder: number;
  isActive: boolean;
}) {
  return {
    id: row.id,
    competitionId: row.competitionId,
    name: row.name,
    type: row.tier,
    logoUrl: toAbsoluteAssetUrl(row.logoUrl),
    websiteUrl: row.websiteUrl,
    displayOrder: row.displayOrder,
    isActive: row.isActive,
  };
}

async function removeStoredLogo(logoUrl: string | null | undefined): Promise<void> {
  await destroyCloudinaryImage(logoUrl);
  const localPath = resolveLocalUploadPath(logoUrl);
  if (!localPath) return;
  await unlink(localPath).catch(() => undefined);
}

export async function listSponsors(competitionId: string, opts?: { activeOnly?: boolean }) {
  await getCompetition(competitionId);
  const rows = await prisma.sponsor.findMany({
    where: {
      competitionId,
      ...(opts?.activeOnly ? { isActive: true } : {}),
    },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  });
  return rows.map(mapSponsor);
}

export async function getSponsor(competitionId: string, sponsorId: string) {
  const row = await prisma.sponsor.findFirst({
    where: { id: sponsorId, competitionId },
  });
  if (!row) throw AppError.notFound('Sponsor not found');
  return mapSponsor(row);
}

export async function createSponsor(competitionId: string, input: CreateSponsorInput) {
  await getCompetition(competitionId);
  const maxOrder = await prisma.sponsor.aggregate({
    where: { competitionId },
    _max: { displayOrder: true },
  });
  const row = await prisma.sponsor.create({
    data: {
      competitionId,
      name: input.name,
      tier: input.type ?? null,
      websiteUrl: input.websiteUrl,
      logoUrl: input.logoUrl,
      displayOrder: input.displayOrder ?? (maxOrder._max.displayOrder ?? 0) + 1,
      isActive: input.isActive ?? true,
    },
  });
  return mapSponsor(row);
}

export async function updateSponsor(
  competitionId: string,
  sponsorId: string,
  input: UpdateSponsorInput,
) {
  const existing = await getSponsor(competitionId, sponsorId);
  const row = await prisma.sponsor.update({
    where: { id: sponsorId },
    data: {
      ...(input.name != null ? { name: input.name } : {}),
      ...(input.type !== undefined ? { tier: input.type } : {}),
      ...(input.websiteUrl !== undefined ? { websiteUrl: input.websiteUrl ?? null } : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl ?? null } : {}),
      ...(input.displayOrder != null ? { displayOrder: input.displayOrder } : {}),
      ...(input.isActive != null ? { isActive: input.isActive } : {}),
    },
  });
  if (input.logoUrl !== undefined && input.logoUrl !== existing.logoUrl) {
    await removeStoredLogo(existing.logoUrl);
  }
  return mapSponsor(row);
}

export async function deleteSponsor(competitionId: string, sponsorId: string) {
  const existing = await getSponsor(competitionId, sponsorId);
  await prisma.sponsor.delete({ where: { id: sponsorId } });
  await removeStoredLogo(existing.logoUrl);
  return { deleted: true };
}

export async function uploadSponsorLogo(
  competitionId: string,
  sponsorId: string,
  file: Express.Multer.File,
) {
  const existing = await getSponsor(competitionId, sponsorId);

  const uploaded = await uploadImageToCloudinary(file, {
    folder: `sponsors/${competitionId}`,
    maxEdge: 1600,
    allowSvg: true,
  });

  const row = await prisma.sponsor.update({
    where: { id: sponsorId },
    data: { logoUrl: uploaded.url },
  });
  if (existing.logoUrl && existing.logoUrl !== uploaded.url) {
    await removeStoredLogo(existing.logoUrl);
  }
  return mapSponsor(row);
}

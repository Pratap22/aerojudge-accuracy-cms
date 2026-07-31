import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CreateSponsorInput, UpdateSponsorInput } from '@npha/shared';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { buildUploadUrl, toAbsoluteAssetUrl } from '../utils/assets.js';
import { getCompetition } from './competition.service.js';

function mapSponsor(row: {
  id: string;
  competitionId: string;
  name: string;
  tier: string;
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
      tier: input.type ?? 'STANDARD',
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
  await getSponsor(competitionId, sponsorId);
  const row = await prisma.sponsor.update({
    where: { id: sponsorId },
    data: {
      ...(input.name != null ? { name: input.name } : {}),
      ...(input.type != null ? { tier: input.type } : {}),
      ...(input.websiteUrl !== undefined ? { websiteUrl: input.websiteUrl ?? null } : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl ?? null } : {}),
      ...(input.displayOrder != null ? { displayOrder: input.displayOrder } : {}),
      ...(input.isActive != null ? { isActive: input.isActive } : {}),
    },
  });
  return mapSponsor(row);
}

export async function deleteSponsor(competitionId: string, sponsorId: string) {
  await getSponsor(competitionId, sponsorId);
  await prisma.sponsor.delete({ where: { id: sponsorId } });
  return { deleted: true };
}

export async function uploadSponsorLogo(
  competitionId: string,
  sponsorId: string,
  file: Express.Multer.File,
) {
  await getSponsor(competitionId, sponsorId);

  const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
  if (!allowed.includes(file.mimetype)) {
    throw AppError.badRequest('Logo must be PNG, JPEG, WebP, or SVG');
  }

  const ext =
    file.mimetype === 'image/png'
      ? '.png'
      : file.mimetype === 'image/webp'
        ? '.webp'
        : file.mimetype === 'image/svg+xml'
          ? '.svg'
          : '.jpg';

  const dir = path.join(env.uploadDir, 'sponsors', competitionId);
  await mkdir(dir, { recursive: true });
  const filename = `${sponsorId}${ext}`;
  await writeFile(path.join(dir, filename), file.buffer);

  const logoUrl = buildUploadUrl('sponsors', competitionId, filename);
  const row = await prisma.sponsor.update({
    where: { id: sponsorId },
    data: { logoUrl },
  });
  return mapSponsor(row);
}

import type { CreateOfficialInput, UpdateOfficialInput } from '@npha/shared';
import { compareOfficials, officialRoleRank } from '@npha/shared';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { uploadImageToCloudinary } from '../utils/cloudinary.js';
import { getCompetition } from './competition.service.js';

function mapOfficial(row: {
  id: string;
  competitionId: string;
  name: string;
  role: string;
  imageUrl: string | null;
  phone: string | null;
  email: string | null;
  displayOrder: number;
  isPublic: boolean;
}) {
  return {
    id: row.id,
    competitionId: row.competitionId,
    name: row.name,
    role: row.role,
    imageUrl: row.imageUrl,
    phone: row.phone,
    email: row.email,
    displayOrder: row.displayOrder,
    isPublic: row.isPublic,
  };
}

export async function listOfficials(competitionId: string, opts?: { publicOnly?: boolean }) {
  await getCompetition(competitionId);
  const rows = await prisma.competitionOfficial.findMany({
    where: {
      competitionId,
      ...(opts?.publicOnly ? { isPublic: true } : {}),
    },
  });
  return rows.map(mapOfficial).sort(compareOfficials);
}

export async function getOfficial(competitionId: string, officialId: string) {
  const row = await prisma.competitionOfficial.findFirst({
    where: { id: officialId, competitionId },
  });
  if (!row) throw AppError.notFound('Official not found');
  return mapOfficial(row);
}

export async function createOfficial(competitionId: string, input: CreateOfficialInput) {
  await getCompetition(competitionId);
  const role = input.role.trim();
  const row = await prisma.competitionOfficial.create({
    data: {
      competitionId,
      name: input.name.trim(),
      role,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      imageUrl: input.imageUrl?.trim() || null,
      displayOrder: input.displayOrder ?? officialRoleRank(role) * 10,
      isPublic: input.isPublic ?? true,
    },
  });
  return mapOfficial(row);
}

export async function updateOfficial(
  competitionId: string,
  officialId: string,
  input: UpdateOfficialInput,
) {
  await getOfficial(competitionId, officialId);
  const row = await prisma.competitionOfficial.update({
    where: { id: officialId },
    data: {
      ...(input.name != null ? { name: input.name.trim() } : {}),
      ...(input.role != null ? { role: input.role.trim() } : {}),
      ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
      ...(input.email !== undefined ? { email: input.email?.trim() || null } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl?.trim() || null } : {}),
      ...(input.displayOrder != null ? { displayOrder: input.displayOrder } : {}),
      ...(input.isPublic != null ? { isPublic: input.isPublic } : {}),
    },
  });
  return mapOfficial(row);
}

export async function deleteOfficial(competitionId: string, officialId: string) {
  await getOfficial(competitionId, officialId);
  await prisma.competitionOfficial.delete({ where: { id: officialId } });
  return { deleted: true };
}

export async function uploadOfficialPhoto(
  competitionId: string,
  officialId: string,
  file: Express.Multer.File,
) {
  await getOfficial(competitionId, officialId);
  const { url } = await uploadImageToCloudinary(file, {
    folder: `officials/${competitionId}`,
    publicId: officialId,
  });
  const row = await prisma.competitionOfficial.update({
    where: { id: officialId },
    data: { imageUrl: url },
  });
  return mapOfficial(row);
}

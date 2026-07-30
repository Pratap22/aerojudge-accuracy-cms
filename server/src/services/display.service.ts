import type { Prisma } from '@npha/database';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { getCompetition } from './competition.service.js';

export async function listDisplayLayouts(competitionId: string) {
  await getCompetition(competitionId);
  return prisma.displayLayout.findMany({
    where: { competitionId },
    orderBy: { name: 'asc' },
  });
}

export async function getDisplayLayout(competitionId: string, id: string) {
  const layout = await prisma.displayLayout.findFirst({ where: { id, competitionId } });
  if (!layout) throw AppError.notFound('Display layout not found');
  return layout;
}

export async function createDisplayLayout(
  competitionId: string,
  data: { name: string; type: string; configJson: Record<string, unknown>; isDefault?: boolean },
) {
  await getCompetition(competitionId);

  if (data.isDefault) {
    await prisma.displayLayout.updateMany({
      where: { competitionId, type: data.type },
      data: { isDefault: false },
    });
  }

  return prisma.displayLayout.create({
    data: {
      competitionId,
      name: data.name,
      type: data.type,
      configJson: data.configJson as object,
      isDefault: data.isDefault ?? false,
    },
  });
}

export async function updateDisplayLayout(
  competitionId: string,
  id: string,
  data: Prisma.DisplayLayoutUpdateInput,
) {
  await getDisplayLayout(competitionId, id);
  return prisma.displayLayout.update({ where: { id }, data });
}

export async function deleteDisplayLayout(competitionId: string, id: string): Promise<void> {
  await getDisplayLayout(competitionId, id);
  await prisma.displayLayout.delete({ where: { id } });
}

export async function getDefaultLayout(competitionId: string, type: string) {
  await getCompetition(competitionId);
  return prisma.displayLayout.findFirst({
    where: { competitionId, type, isDefault: true },
  });
}

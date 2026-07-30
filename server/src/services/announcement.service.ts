import type { Prisma } from '@npha/database';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { getCompetition } from './competition.service.js';

export async function listAnnouncements(competitionId: string, liveOnly = false) {
  await getCompetition(competitionId);
  const where: Prisma.AnnouncementWhereInput = { competitionId };
  if (liveOnly) {
    where.isLive = true;
    where.OR = [{ expiresAt: null }, { expiresAt: { gt: new Date() } }];
  }

  return prisma.announcement.findMany({
    where,
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
  });
}

export async function createAnnouncement(
  competitionId: string,
  data: {
    title: string;
    body: string;
    priority?: string;
    isLive?: boolean;
    expiresAt?: Date;
    createdById?: string;
  },
) {
  await getCompetition(competitionId);
  return prisma.announcement.create({
    data: {
      competitionId,
      title: data.title,
      body: data.body,
      priority: data.priority ?? 'NORMAL',
      isLive: data.isLive ?? true,
      expiresAt: data.expiresAt,
      createdById: data.createdById,
    },
  });
}

export async function updateAnnouncement(
  competitionId: string,
  id: string,
  data: Prisma.AnnouncementUpdateInput,
) {
  const ann = await prisma.announcement.findFirst({ where: { id, competitionId } });
  if (!ann) throw AppError.notFound('Announcement not found');
  return prisma.announcement.update({ where: { id }, data });
}

export async function deleteAnnouncement(competitionId: string, id: string): Promise<void> {
  const ann = await prisma.announcement.findFirst({ where: { id, competitionId } });
  if (!ann) throw AppError.notFound('Announcement not found');
  await prisma.announcement.delete({ where: { id } });
}

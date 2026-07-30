import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';

export async function enqueueSyncItem(
  userId: string,
  data: { clientId: string; operation: string; payloadJson: Record<string, unknown> },
) {
  return prisma.offlineSyncQueue.create({
    data: {
      userId,
      clientId: data.clientId,
      operation: data.operation,
      payloadJson: data.payloadJson as object,
      status: 'PENDING',
    },
  });
}

export async function listPendingSync(userId: string) {
  return prisma.offlineSyncQueue.findMany({
    where: { userId, status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
  });
}

export async function markSynced(id: string, userId: string) {
  const item = await prisma.offlineSyncQueue.findFirst({ where: { id, userId } });
  if (!item) throw AppError.notFound('Sync item not found');

  return prisma.offlineSyncQueue.update({
    where: { id },
    data: { status: 'SYNCED', syncedAt: new Date() },
  });
}

export async function markFailed(id: string, userId: string, error: string) {
  const item = await prisma.offlineSyncQueue.findFirst({ where: { id, userId } });
  if (!item) throw AppError.notFound('Sync item not found');

  return prisma.offlineSyncQueue.update({
    where: { id },
    data: {
      status: 'FAILED',
      attempts: { increment: 1 },
      lastError: error,
    },
  });
}

export async function processSyncBatch(userId: string, clientId: string) {
  const items = await prisma.offlineSyncQueue.findMany({
    where: { userId, clientId, status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  const results = [];
  for (const item of items) {
    try {
      await prisma.offlineSyncQueue.update({
        where: { id: item.id },
        data: { status: 'SYNCED', syncedAt: new Date() },
      });
      results.push({ id: item.id, status: 'SYNCED' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      await markFailed(item.id, userId, message);
      results.push({ id: item.id, status: 'FAILED', error: message });
    }
  }

  return results;
}

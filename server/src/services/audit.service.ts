import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export interface ListAuditQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  sortOrder?: 'asc' | 'desc';
  action?: string;
  entityType?: string;
  userId?: string;
}

export interface AuditLogListItem {
  id: string;
  timestamp: string;
  userId: string | null;
  userName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  beforeJson?: unknown;
  afterJson?: unknown;
}

function actorName(user: {
  firstName: string;
  lastName: string;
  email: string;
} | null): string {
  if (!user) return 'System';
  const name = `${user.firstName} ${user.lastName}`.trim();
  return name || user.email;
}

/** Human-readable summary for list UI — not full JSON dump. */
export function summarizeAuditDetails(input: {
  action: string;
  entityType: string;
  entityId?: string | null;
  beforeJson?: unknown;
  afterJson?: unknown;
}): string {
  const parts: string[] = [];
  if (input.entityId) {
    parts.push(`${input.entityType} ${input.entityId.slice(0, 8)}…`);
  } else {
    parts.push(input.entityType);
  }

  const before = input.beforeJson as Record<string, unknown> | null | undefined;
  const after = input.afterJson as Record<string, unknown> | null | undefined;

  if (before && after && typeof before === 'object' && typeof after === 'object') {
    const interesting = ['status', 'score', 'distance', 'result', 'name', 'role', 'pilotNumber'];
    const changes: string[] = [];
    for (const key of interesting) {
      if (key in before || key in after) {
        if (before[key] !== after[key]) {
          changes.push(`${key}: ${String(before[key] ?? '—')} → ${String(after[key] ?? '—')}`);
        }
      }
    }
    if (changes.length > 0) {
      parts.push(changes.slice(0, 3).join('; '));
      return parts.join(' · ');
    }
  }

  if (after && typeof after === 'object') {
    const a = after as Record<string, unknown>;
    if (a.status != null) parts.push(`status=${String(a.status)}`);
    else if (a.score != null) parts.push(`score=${String(a.score)}`);
    else if (a.name != null) parts.push(String(a.name));
  }

  parts.unshift(input.action);
  return parts.join(' · ');
}

export async function listCompetitionAuditLogs(
  competitionId: string,
  query: ListAuditQuery = {},
): Promise<{ items: AuditLogListItem[]; page: number; pageSize: number; total: number }> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 50;
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
  const search = query.search?.trim();

  const where: Prisma.AuditLogWhereInput = {
    competitionId,
  };

  if (query.action) where.action = { contains: query.action, mode: 'insensitive' };
  if (query.entityType) where.entityType = { contains: query.entityType, mode: 'insensitive' };
  if (query.userId) where.userId = query.userId;

  if (search) {
    where.OR = [
      { action: { contains: search, mode: 'insensitive' } },
      { entityType: { contains: search, mode: 'insensitive' } },
      { entityId: { contains: search, mode: 'insensitive' } },
      {
        user: {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        },
      },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    }),
  ]);

  const items: AuditLogListItem[] = rows.map((row) => ({
    id: row.id,
    timestamp: row.createdAt.toISOString(),
    userId: row.userId,
    userName: actorName(row.user),
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    details: summarizeAuditDetails({
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      beforeJson: row.beforeJson,
      afterJson: row.afterJson,
    }),
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    beforeJson: row.beforeJson,
    afterJson: row.afterJson,
  }));

  return { items, page, pageSize, total };
}

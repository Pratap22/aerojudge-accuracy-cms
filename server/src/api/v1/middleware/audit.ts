import type { Request } from 'express';
import { prisma } from '../../../config/prisma.js';

export interface AuditLogInput {
  competitionId?: string | null;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  req?: Request;
}

export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      competitionId: input.competitionId ?? undefined,
      userId: input.userId ?? undefined,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? undefined,
      beforeJson: input.before ? (input.before as object) : undefined,
      afterJson: input.after ? (input.after as object) : undefined,
      ipAddress: input.req?.ip ?? input.req?.socket.remoteAddress ?? undefined,
      userAgent: input.req?.headers['user-agent'] ?? undefined,
    },
  });
}

export function auditFromRequest(req: Request) {
  return {
    userId: req.user?.id ?? null,
    req,
  };
}

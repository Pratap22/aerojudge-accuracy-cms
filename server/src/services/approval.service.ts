import type { Role } from '@npha/shared';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { getRound } from './round.service.js';

export async function listApprovals(competitionId: string, roundId: string) {
  await getRound(competitionId, roundId);
  return prisma.scoreApproval.findMany({
    where: { roundId },
    include: { approver: { select: { id: true, firstName: true, lastName: true, role: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

export async function requestApproval(competitionId: string, roundId: string) {
  const round = await getRound(competitionId, roundId);
  if (round.status !== 'CLOSED' && round.status !== 'PENDING_APPROVAL') {
    throw AppError.badRequest('Round must be closed before requesting approval');
  }

  await prisma.round.update({
    where: { id: roundId },
    data: { status: 'PENDING_APPROVAL' },
  });

  const directors = await prisma.user.findMany({
    where: { role: { in: ['COMPETITION_DIRECTOR', 'SUPER_ADMIN'] }, status: 'ACTIVE' },
  });
  const chiefJudges = await prisma.user.findMany({
    where: { role: { in: ['CHIEF_JUDGE', 'SUPER_ADMIN'] }, status: 'ACTIVE' },
  });

  const approvals = [];
  for (const user of chiefJudges) {
    approvals.push(
      await prisma.scoreApproval.upsert({
        where: { roundId_approverId_role: { roundId, approverId: user.id, role: 'CHIEF_JUDGE' } },
        create: { roundId, approverId: user.id, role: 'CHIEF_JUDGE', status: 'PENDING' },
        update: { status: 'PENDING', decidedAt: null },
      }),
    );
  }
  for (const user of directors) {
    approvals.push(
      await prisma.scoreApproval.upsert({
        where: {
          roundId_approverId_role: { roundId, approverId: user.id, role: 'COMPETITION_DIRECTOR' },
        },
        create: { roundId, approverId: user.id, role: 'COMPETITION_DIRECTOR', status: 'PENDING' },
        update: { status: 'PENDING', decidedAt: null },
      }),
    );
  }

  return { roundId, approvals };
}

export async function decideApproval(
  competitionId: string,
  roundId: string,
  approverId: string,
  role: Role,
  decision: 'APPROVED' | 'REJECTED',
  comments?: string,
) {
  await getRound(competitionId, roundId);

  const approval = await prisma.scoreApproval.findUnique({
    where: { roundId_approverId_role: { roundId, approverId, role } },
  });
  if (!approval) throw AppError.notFound('Approval record not found');
  if (approval.status !== 'PENDING') {
    throw AppError.badRequest('Approval already decided');
  }

  await prisma.scoreApproval.update({
    where: { id: approval.id },
    data: { status: decision, comments, decidedAt: new Date() },
  });

  const pending = await prisma.scoreApproval.count({
    where: { roundId, status: 'PENDING' },
  });

  if (decision === 'REJECTED') {
    await prisma.round.update({
      where: { id: roundId },
      data: { status: 'CLOSED' },
    });
    return { roundId, status: 'REJECTED', pending };
  }

  if (pending === 0) {
    await prisma.round.update({
      where: { id: roundId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedById: approverId,
        approvedByRole:
          role === 'CHIEF_JUDGE'
            ? 'Chief Judge'
            : role === 'COMPETITION_DIRECTOR'
              ? 'Meet Director'
              : String(role).replace(/_/g, ' '),
      },
    });
    await prisma.score.updateMany({
      where: { roundId, status: 'CONFIRMED' },
      data: { status: 'APPROVED' },
    });
    return { roundId, status: 'APPROVED', pending: 0 };
  }

  return { roundId, status: 'PENDING', pending };
}

export async function getApprovalStatus(competitionId: string, roundId: string) {
  const approvals = await listApprovals(competitionId, roundId);
  const round = await getRound(competitionId, roundId);
  const allApproved = approvals.length > 0 && approvals.every((a) => a.status === 'APPROVED');
  const anyRejected = approvals.some((a) => a.status === 'REJECTED');

  return {
    roundStatus: round.status,
    allApproved,
    anyRejected,
    approvals,
  };
}

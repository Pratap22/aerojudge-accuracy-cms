import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import * as approvalService from '../../../services/approval.service.js';
import { auditFromRequest, writeAuditLog } from '../middleware/audit.js';
import { validateBody, validateParams } from '../middleware/validate.js';

const roundParams = z.object({ competitionId: z.string().min(1), roundId: z.string().min(1) });
const decideBody = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  comments: z.string().optional(),
});

export const list = [
  validateParams(roundParams),
  asyncHandler(async (req: Request, res: Response) => {
    const approvals = await approvalService.listApprovals(
      req.params.competitionId,
      req.params.roundId,
    );
    sendSuccess(res, approvals);
  }),
];

export const request = [
  validateParams(roundParams),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await approvalService.requestApproval(
      req.params.competitionId,
      req.params.roundId,
    );
    await writeAuditLog({
      ...auditFromRequest(req),
      competitionId: req.params.competitionId,
      action: 'APPROVAL_REQUESTED',
      entityType: 'Round',
      entityId: req.params.roundId,
      after: result,
    });
    sendSuccess(res, result, 201);
  }),
];

export const chiefJudgeDecide = [
  validateParams(roundParams),
  validateBody(decideBody),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await approvalService.decideApproval(
      req.params.competitionId,
      req.params.roundId,
      req.user!.id,
      'CHIEF_JUDGE',
      req.body.decision,
      req.body.comments,
    );
    await writeAuditLog({
      ...auditFromRequest(req),
      competitionId: req.params.competitionId,
      action: req.body.decision === 'APPROVED' ? 'APPROVAL_CHIEF_APPROVED' : 'APPROVAL_CHIEF_REJECTED',
      entityType: 'Round',
      entityId: req.params.roundId,
      after: { decision: req.body.decision, comments: req.body.comments, result },
    });
    sendSuccess(res, result);
  }),
];

export const directorDecide = [
  validateParams(roundParams),
  validateBody(decideBody),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await approvalService.decideApproval(
      req.params.competitionId,
      req.params.roundId,
      req.user!.id,
      'COMPETITION_DIRECTOR',
      req.body.decision,
      req.body.comments,
    );
    await writeAuditLog({
      ...auditFromRequest(req),
      competitionId: req.params.competitionId,
      action:
        req.body.decision === 'APPROVED' ? 'APPROVAL_DIRECTOR_APPROVED' : 'APPROVAL_DIRECTOR_REJECTED',
      entityType: 'Round',
      entityId: req.params.roundId,
      after: { decision: req.body.decision, comments: req.body.comments, result },
    });
    sendSuccess(res, result);
  }),
];

export const status = [
  validateParams(roundParams),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await approvalService.getApprovalStatus(
      req.params.competitionId,
      req.params.roundId,
    );
    sendSuccess(res, result);
  }),
];

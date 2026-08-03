import type { Request, Response } from 'express';
import { paginationSchema } from '@npha/shared';
import { z } from 'zod';
import { asyncHandler } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import * as auditService from '../../../services/audit.service.js';
import { validateParams, validateQuery } from '../middleware/validate.js';

const competitionParams = z.object({ competitionId: z.string().min(1) });

const listQuery = paginationSchema.extend({
  action: z.string().optional(),
  entityType: z.string().optional(),
  userId: z.string().optional(),
});

export const list = [
  validateParams(competitionParams),
  validateQuery(listQuery),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await auditService.listCompetitionAuditLogs(req.params.competitionId, {
      page: Number(req.query.page) || undefined,
      pageSize: Number(req.query.pageSize) || undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      sortOrder: req.query.sortOrder === 'asc' ? 'asc' : 'desc',
      action: typeof req.query.action === 'string' ? req.query.action : undefined,
      entityType: typeof req.query.entityType === 'string' ? req.query.entityType : undefined,
      userId: typeof req.query.userId === 'string' ? req.query.userId : undefined,
    });
    sendSuccess(res, result.items, 200, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    });
  }),
];

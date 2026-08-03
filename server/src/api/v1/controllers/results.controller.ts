import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import * as scoringService from '../../../services/scoring.service.js';
import { emitRankingUpdated, emitResultsPublished } from '../../../socket/index.js';
import { auditFromRequest, writeAuditLog } from '../middleware/audit.js';
import { validateParams, validateQuery } from '../middleware/validate.js';

const competitionParams = z.object({ competitionId: z.string().min(1) });
const categoryQuery = z.object({
  category: z.enum(['OVERALL', 'WOMEN', 'JUNIOR', 'COUNTRY', 'TEAM']).default('OVERALL'),
});

export const recalculate = [
  validateParams(competitionParams),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await scoringService.recalculateRankings(req.params.competitionId);
    for (const category of result.categories) {
      emitRankingUpdated(req.params.competitionId, category);
    }
    emitRankingUpdated(req.params.competitionId, 'TEAM');
    sendSuccess(res, result);
  }),
];

export const individual = [
  validateParams(competitionParams),
  validateQuery(categoryQuery),
  asyncHandler(async (req: Request, res: Response) => {
    const rankings = await scoringService.getIndividualRankings(
      req.params.competitionId,
      req.query.category as never,
    );
    sendSuccess(res, rankings);
  }),
];

export const team = [
  validateParams(competitionParams),
  asyncHandler(async (req: Request, res: Response) => {
    const rankings = await scoringService.getTeamRankings(req.params.competitionId);
    sendSuccess(res, rankings);
  }),
];

export const country = [
  validateParams(competitionParams),
  asyncHandler(async (req: Request, res: Response) => {
    const rankings = await scoringService.getCountryRankings(req.params.competitionId);
    sendSuccess(res, rankings);
  }),
];

export const women = [
  validateParams(competitionParams),
  asyncHandler(async (req: Request, res: Response) => {
    const rankings = await scoringService.getWomenRankings(req.params.competitionId);
    sendSuccess(res, rankings);
  }),
];

export const publish = [
  validateParams(competitionParams),
  validateQuery(categoryQuery),
  asyncHandler(async (req: Request, res: Response) => {
    const category = req.query.category as string;
    const result = await scoringService.publishResults(req.params.competitionId, category);
    emitResultsPublished(req.params.competitionId, '', category);
    await writeAuditLog({
      ...auditFromRequest(req),
      competitionId: req.params.competitionId,
      action: 'RESULT_PUBLISHED',
      entityType: 'Result',
      entityId: req.params.competitionId,
      after: { category, result },
    });
    sendSuccess(res, result);
  }),
];

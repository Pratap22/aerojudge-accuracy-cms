import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import * as scoringService from '../../../services/scoring.service.js';
import { emitRankingUpdated } from '../../../socket/index.js';
import { validateParams } from '../middleware/validate.js';

const competitionParams = z.object({ competitionId: z.string().min(1) });

async function ensureRankings(competitionId: string) {
  const existing = await scoringService.getIndividualRankings(competitionId, 'OVERALL');
  if (existing.length > 0) return existing;
  // Rebuild from current scores if none persisted yet (e.g. first load after scoring)
  await scoringService.recalculateRankings(competitionId);
  return scoringService.getIndividualRankings(competitionId, 'OVERALL');
}

export const overall = [
  validateParams(competitionParams),
  asyncHandler(async (req: Request, res: Response) => {
    const rankings = await ensureRankings(req.params.competitionId);
    sendSuccess(res, rankings);
  }),
];

export const women = [
  validateParams(competitionParams),
  asyncHandler(async (req: Request, res: Response) => {
    await ensureRankings(req.params.competitionId);
    const rankings = await scoringService.getIndividualRankings(req.params.competitionId, 'WOMEN');
    sendSuccess(res, rankings);
  }),
];

export const junior = [
  validateParams(competitionParams),
  asyncHandler(async (req: Request, res: Response) => {
    await ensureRankings(req.params.competitionId);
    const rankings = await scoringService.getIndividualRankings(req.params.competitionId, 'JUNIOR');
    sendSuccess(res, rankings);
  }),
];

export const team = [
  validateParams(competitionParams),
  asyncHandler(async (req: Request, res: Response) => {
    await ensureRankings(req.params.competitionId);
    let rankings = await scoringService.getTeamRankings(req.params.competitionId);
    if (rankings.length === 0) {
      await scoringService.recalculateRankings(req.params.competitionId);
      rankings = await scoringService.getTeamRankings(req.params.competitionId);
    }
    sendSuccess(res, rankings);
  }),
];

export const country = [
  validateParams(competitionParams),
  asyncHandler(async (req: Request, res: Response) => {
    await ensureRankings(req.params.competitionId);
    const rankings = await scoringService.getCountryRankings(req.params.competitionId);
    sendSuccess(res, rankings);
  }),
];

export const recalculate = [
  validateParams(competitionParams),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await scoringService.recalculateRankings(req.params.competitionId);
    for (const category of result.categories) {
      emitRankingUpdated(req.params.competitionId, category);
    }
    emitRankingUpdated(req.params.competitionId, 'TEAM');
    emitRankingUpdated(req.params.competitionId, 'COUNTRY');
    sendSuccess(res, result);
  }),
];

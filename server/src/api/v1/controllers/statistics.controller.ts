import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import * as statisticsService from '../../../services/statistics.service.js';
import { validateParams } from '../middleware/validate.js';

const competitionParams = z.object({ competitionId: z.string().min(1) });
const roundParams = z.object({ competitionId: z.string().min(1), roundId: z.string().min(1) });

export const competition = [
  validateParams(competitionParams),
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await statisticsService.getCompetitionStatistics(req.params.competitionId);
    sendSuccess(res, stats);
  }),
];

export const round = [
  validateParams(roundParams),
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await statisticsService.getRoundStatistics(
      req.params.competitionId,
      req.params.roundId,
    );
    sendSuccess(res, stats);
  }),
];

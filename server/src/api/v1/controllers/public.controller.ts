import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import * as publicService from '../../../services/public.service.js';
import { validateParams, validateQuery } from '../middleware/validate.js';

const slugParams = z.object({ slug: z.string().min(1) });
const roundQuery = z.object({ round: z.coerce.number().int().positive() });
const categoryQuery = z.object({
  category: z.enum(['OVERALL', 'WOMEN', 'JUNIOR', 'TEAM', 'COUNTRY']).default('OVERALL'),
});

export const listCompetitions = [
  asyncHandler(async (_req: Request, res: Response) => {
    const competitions = await publicService.listPublicCompetitions();
    sendSuccess(res, competitions);
  }),
];

export const getCompetition = [
  validateParams(slugParams),
  asyncHandler(async (req: Request, res: Response) => {
    const competition = await publicService.getPublicCompetition(req.params.slug);
    sendSuccess(res, competition);
  }),
];

export const getResults = [
  validateParams(slugParams),
  validateQuery(categoryQuery),
  asyncHandler(async (req: Request, res: Response) => {
    const results = await publicService.getPublicResults(
      req.params.slug,
      req.query.category as string,
    );
    sendSuccess(res, results);
  }),
];

export const getRoundResults = [
  validateParams(slugParams),
  validateQuery(roundQuery),
  asyncHandler(async (req: Request, res: Response) => {
    const { round } = roundQuery.parse(req.query as unknown);
    const results = await publicService.getPublicRoundResults(req.params.slug, round);
    sendSuccess(res, results);
  }),
];

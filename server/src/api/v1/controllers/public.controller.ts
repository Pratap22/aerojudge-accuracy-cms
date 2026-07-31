import type { Request, Response } from 'express';
import { publicPilotRegistrationSchema } from '@npha/shared';
import { z } from 'zod';
import { asyncHandler } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import * as publicService from '../../../services/public.service.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';

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

export const getRoundsStatus = [
  validateParams(slugParams),
  asyncHandler(async (req: Request, res: Response) => {
    const status = await publicService.getPublicRoundsStatus(req.params.slug);
    sendSuccess(res, status);
  }),
];

export const getLatestScore = [
  validateParams(slugParams),
  asyncHandler(async (req: Request, res: Response) => {
    const latest = await publicService.getLatestPublicScore(req.params.slug);
    sendSuccess(res, latest);
  }),
];

export const getSponsors = [
  validateParams(slugParams),
  asyncHandler(async (req: Request, res: Response) => {
    const sponsors = await publicService.getPublicSponsors(req.params.slug);
    sendSuccess(res, sponsors);
  }),
];

export const listCountries = [
  asyncHandler(async (_req: Request, res: Response) => {
    const countries = await publicService.listPublicCountries();
    sendSuccess(res, countries);
  }),
];

export const listPilots = [
  validateParams(slugParams),
  asyncHandler(async (req: Request, res: Response) => {
    const pilots = await publicService.listPublicPilots(req.params.slug);
    sendSuccess(res, pilots);
  }),
];

export const registerPilot = [
  validateParams(slugParams),
  validateBody(publicPilotRegistrationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const pilot = await publicService.registerPublicPilot(req.params.slug, req.body);
    sendSuccess(res, pilot, 201);
  }),
];

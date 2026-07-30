import type { Request, Response } from 'express';
import { createCompetitionSchema, paginationSchema } from '@npha/shared';
import { z } from 'zod';
import { asyncHandler } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import * as competitionService from '../../../services/competition.service.js';
import * as dashboardService from '../../../services/dashboard.service.js';
import { auditFromRequest, writeAuditLog } from '../middleware/audit.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';

const idParams = z.object({ id: z.string().min(1) });

const settingsSchema = z.object({
  bullseyeScoreCm: z.number().optional(),
  maximumScoreCm: z.number().optional(),
  discardWorstRounds: z.number().int().optional(),
  discardAfterRounds: z.number().int().optional(),
  allowReflights: z.boolean().optional(),
  maxReflightsPerRound: z.number().int().optional(),
  teamSize: z.number().int().optional(),
  teamScoringPilots: z.number().int().optional(),
  teamAllowReserves: z.boolean().optional(),
  teamMaxReserves: z.number().int().optional(),
  womenCategoryEnabled: z.boolean().optional(),
  juniorCategoryEnabled: z.boolean().optional(),
  juniorMaxAge: z.number().int().optional(),
  countryRankingEnabled: z.boolean().optional(),
  livePublicResults: z.boolean().optional(),
});

export const list = [
  validateQuery(paginationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await competitionService.listCompetitions(req.query as never);
    sendSuccess(res, result.items, 200, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    });
  }),
];

export const get = [
  validateParams(idParams),
  asyncHandler(async (req: Request, res: Response) => {
    const competition = await competitionService.getCompetition(req.params.id);
    sendSuccess(res, competition);
  }),
];

export const create = [
  validateBody(createCompetitionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const data = req.body;
    const competition = await competitionService.createCompetition({
      ...data,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
    });
    await writeAuditLog({
      ...auditFromRequest(req),
      competitionId: competition.id,
      action: 'CREATE',
      entityType: 'Competition',
      entityId: competition.id,
      after: competition,
    });
    sendSuccess(res, competition, 201);
  }),
];

export const update = [
  validateParams(idParams),
  asyncHandler(async (req: Request, res: Response) => {
    const before = await competitionService.getCompetition(req.params.id);
    const competition = await competitionService.updateCompetition(req.params.id, req.body);
    await writeAuditLog({
      ...auditFromRequest(req),
      competitionId: competition.id,
      action: 'UPDATE',
      entityType: 'Competition',
      entityId: competition.id,
      before,
      after: competition,
    });
    sendSuccess(res, competition);
  }),
];

export const remove = [
  validateParams(idParams),
  asyncHandler(async (req: Request, res: Response) => {
    const before = await competitionService.getCompetition(req.params.id);
    await competitionService.deleteCompetition(req.params.id);
    await writeAuditLog({
      ...auditFromRequest(req),
      competitionId: req.params.id,
      action: 'DELETE',
      entityType: 'Competition',
      entityId: req.params.id,
      before,
    });
    sendSuccess(res, { deleted: true });
  }),
];

export const getSettings = [
  validateParams(idParams),
  asyncHandler(async (req: Request, res: Response) => {
    const competition = await competitionService.getCompetition(req.params.id);
    sendSuccess(res, competition.settings ?? null);
  }),
];

export const updateSettingsHandler = [
  validateParams(idParams),
  validateBody(settingsSchema.passthrough()),
  asyncHandler(async (req: Request, res: Response) => {
    const settings = await competitionService.updateSettings(req.params.id, req.body);
    sendSuccess(res, settings);
  }),
];

export const publish = [
  validateParams(idParams),
  asyncHandler(async (req: Request, res: Response) => {
    const competition = await competitionService.publishCompetition(req.params.id);
    await writeAuditLog({
      ...auditFromRequest(req),
      competitionId: competition.id,
      action: 'PUBLISH',
      entityType: 'Competition',
      entityId: competition.id,
    });
    sendSuccess(res, competition);
  }),
];

export const dashboard = [
  validateParams(idParams),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await dashboardService.getCompetitionDashboard(req.params.id);
    sendSuccess(res, data);
  }),
];

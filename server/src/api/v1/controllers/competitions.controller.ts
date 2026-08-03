import type { Request, Response } from 'express';
import { createCompetitionSchema, paginationSchema } from '@npha/shared';
import { ScoringEngine } from '@npha/scoring-engine';
import { z } from 'zod';
import { asyncHandler, AppError } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import * as competitionService from '../../../services/competition.service.js';
import * as dashboardService from '../../../services/dashboard.service.js';
import { auditFromRequest, writeAuditLog } from '../middleware/audit.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';

const idParams = z.object({ id: z.string().min(1) });

const listCompetitionsQuerySchema = paginationSchema.extend({
  status: z
    .enum([
      'DRAFT',
      'REGISTRATION',
      'PRACTICE',
      'OFFICIAL',
      'PAUSED',
      'COMPLETED',
      'ARCHIVED',
      'CANCELLED',
    ])
    .optional(),
});

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
  partnersLabel: z.string().min(1).max(40).optional(),
  partnerTiersEnabled: z.boolean().optional(),
});

export const list = [
  validateQuery(listCompetitionsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.organizationId) {
      sendSuccess(res, [], 200, { page: 1, pageSize: 50, total: 0 });
      return;
    }
    const result = await competitionService.listCompetitions({
      ...(req.query as Record<string, unknown>),
      organizationId: req.organizationId,
    } as Parameters<typeof competitionService.listCompetitions>[0]);
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
    const competition = await competitionService.getCompetition(
      req.params.id,
      req.organizationId,
    );
    sendSuccess(res, competition);
  }),
];

export const create = [
  validateBody(createCompetitionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.organizationId) {
      throw AppError.forbidden('Organization context required to create a competition');
    }
    const data = req.body;
    const competition = await competitionService.createCompetition({
      ...data,
      organizationId: req.organizationId,
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
    const rules = ScoringEngine.resolveRules(
      competition.ruleSet,
      competitionService.settingsToRuleOverrides(competition.settings ?? undefined),
    );
    sendSuccess(res, rules);
  }),
];

export const updateSettingsHandler = [
  validateParams(idParams),
  validateBody(settingsSchema.passthrough()),
  asyncHandler(async (req: Request, res: Response) => {
    const before = await competitionService.getCompetition(req.params.id);
    await competitionService.updateSettings(req.params.id, req.body);
    const competition = await competitionService.getCompetition(req.params.id);
    const rules = ScoringEngine.resolveRules(
      competition.ruleSet,
      competitionService.settingsToRuleOverrides(competition.settings ?? undefined),
    );
    await writeAuditLog({
      ...auditFromRequest(req),
      competitionId: competition.id,
      action: 'SETTINGS_UPDATE',
      entityType: 'CompetitionSettings',
      entityId: competition.id,
      before: before.settings ?? null,
      after: competition.settings ?? null,
    });
    sendSuccess(res, rules);
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

export const complete = [
  validateParams(idParams),
  asyncHandler(async (req: Request, res: Response) => {
    const before = await competitionService.getCompetition(req.params.id);
    const competition = await competitionService.completeCompetition(req.params.id);

    const { recalculateRankings } = await import('../../../services/scoring.service.js');
    await recalculateRankings(competition.id);

    const { emitCompetitionStatus, emitSyncRequired } = await import('../../../socket/index.js');
    emitCompetitionStatus(competition.id, competition.status);
    emitSyncRequired(competition.id);

    await writeAuditLog({
      ...auditFromRequest(req),
      competitionId: competition.id,
      action: 'UPDATE',
      entityType: 'Competition',
      entityId: competition.id,
      before: { status: before.status },
      after: { status: competition.status },
    });
    sendSuccess(res, competition);
  }),
];

export const archive = [
  validateParams(idParams),
  asyncHandler(async (req: Request, res: Response) => {
    const before = await competitionService.getCompetition(req.params.id);
    const competition = await competitionService.archiveCompetition(req.params.id);

    const { emitCompetitionStatus, emitSyncRequired } = await import('../../../socket/index.js');
    emitCompetitionStatus(competition.id, competition.status);
    emitSyncRequired(competition.id);

    await writeAuditLog({
      ...auditFromRequest(req),
      competitionId: competition.id,
      action: 'ARCHIVE',
      entityType: 'Competition',
      entityId: competition.id,
      before: { status: before.status, isPublished: before.isPublished },
      after: { status: competition.status, isPublished: competition.isPublished },
    });
    sendSuccess(res, competition);
  }),
];

export const unarchive = [
  validateParams(idParams),
  asyncHandler(async (req: Request, res: Response) => {
    const before = await competitionService.getCompetition(req.params.id);
    const competition = await competitionService.unarchiveCompetition(req.params.id);

    const { emitCompetitionStatus, emitSyncRequired } = await import('../../../socket/index.js');
    emitCompetitionStatus(competition.id, competition.status);
    emitSyncRequired(competition.id);

    await writeAuditLog({
      ...auditFromRequest(req),
      competitionId: competition.id,
      action: 'UNARCHIVE',
      entityType: 'Competition',
      entityId: competition.id,
      before: { status: before.status, isPublished: before.isPublished },
      after: { status: competition.status, isPublished: competition.isPublished },
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

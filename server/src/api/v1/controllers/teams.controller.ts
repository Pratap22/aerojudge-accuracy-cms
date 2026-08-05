import type { Request, Response } from 'express';
import { createTeamSchema, paginationSchema } from '@npha/shared';
import { z } from 'zod';
import { asyncHandler } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import * as teamService from '../../../services/team.service.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';

const competitionParams = z.object({ competitionId: z.string().min(1) });
const teamParams = z.object({ competitionId: z.string().min(1), teamId: z.string().min(1) });
const membersBody = z.object({
  pilotIds: z.array(z.string().min(1)).min(1),
  roles: z.array(z.enum(['PILOT', 'RESERVE', 'CAPTAIN', 'VICE_CAPTAIN'])).optional(),
});

export const list = [
  validateParams(competitionParams),
  validateQuery(paginationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await teamService.listTeams(req.params.competitionId, req.query as never);
    sendSuccess(res, result.items, 200, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    });
  }),
];

export const get = [
  validateParams(teamParams),
  asyncHandler(async (req: Request, res: Response) => {
    const team = await teamService.getTeam(req.params.competitionId, req.params.teamId);
    sendSuccess(res, team);
  }),
];

export const create = [
  validateParams(competitionParams),
  validateBody(createTeamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const team = await teamService.createTeam(req.params.competitionId, req.body);
    sendSuccess(res, team, 201);
  }),
];

export const update = [
  validateParams(teamParams),
  asyncHandler(async (req: Request, res: Response) => {
    const team = await teamService.updateTeam(req.params.competitionId, req.params.teamId, req.body);
    sendSuccess(res, team);
  }),
];

export const remove = [
  validateParams(teamParams),
  asyncHandler(async (req: Request, res: Response) => {
    await teamService.deleteTeam(req.params.competitionId, req.params.teamId);
    sendSuccess(res, { deleted: true });
  }),
];

export const setMembers = [
  validateParams(teamParams),
  validateBody(membersBody),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await teamService.setTeamMembers(
      req.params.competitionId,
      req.params.teamId,
      req.body.pilotIds,
      req.body.roles,
    );
    const { emitRankingUpdated } = await import('../../../socket/index.js');
    emitRankingUpdated(req.params.competitionId, 'TEAM');
    sendSuccess(res, result);
  }),
];

export const validate = [
  validateParams(teamParams),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await teamService.validateTeam(req.params.competitionId, req.params.teamId);
    sendSuccess(res, result);
  }),
];

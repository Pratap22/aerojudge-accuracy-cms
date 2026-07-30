import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import * as displayService from '../../../services/display.service.js';
import { emitDisplayLayout } from '../../../socket/index.js';
import { validateBody, validateParams } from '../middleware/validate.js';

const competitionParams = z.object({ competitionId: z.string().min(1) });
const layoutParams = z.object({ competitionId: z.string().min(1), id: z.string().min(1) });
const layoutBody = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  configJson: z.record(z.unknown()),
  isDefault: z.boolean().optional(),
});

export const list = [
  validateParams(competitionParams),
  asyncHandler(async (req: Request, res: Response) => {
    const layouts = await displayService.listDisplayLayouts(req.params.competitionId);
    sendSuccess(res, layouts);
  }),
];

export const get = [
  validateParams(layoutParams),
  asyncHandler(async (req: Request, res: Response) => {
    const layout = await displayService.getDisplayLayout(
      req.params.competitionId,
      req.params.id,
    );
    sendSuccess(res, layout);
  }),
];

export const create = [
  validateParams(competitionParams),
  validateBody(layoutBody),
  asyncHandler(async (req: Request, res: Response) => {
    const layout = await displayService.createDisplayLayout(req.params.competitionId, req.body);
    emitDisplayLayout(req.params.competitionId, layout.type, layout.configJson);
    sendSuccess(res, layout, 201);
  }),
];

export const update = [
  validateParams(layoutParams),
  asyncHandler(async (req: Request, res: Response) => {
    const layout = await displayService.updateDisplayLayout(
      req.params.competitionId,
      req.params.id,
      req.body,
    );
    emitDisplayLayout(req.params.competitionId, layout.type, layout.configJson);
    sendSuccess(res, layout);
  }),
];

export const remove = [
  validateParams(layoutParams),
  asyncHandler(async (req: Request, res: Response) => {
    await displayService.deleteDisplayLayout(req.params.competitionId, req.params.id);
    sendSuccess(res, { deleted: true });
  }),
];

export const getDefault = [
  validateParams(competitionParams),
  asyncHandler(async (req: Request, res: Response) => {
    const type = (req.query.type as string) ?? 'CURRENT_PILOT';
    const layout = await displayService.getDefaultLayout(req.params.competitionId, type);
    sendSuccess(res, layout);
  }),
];

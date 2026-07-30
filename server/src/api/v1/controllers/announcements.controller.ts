import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import * as announcementService from '../../../services/announcement.service.js';
import { emitAnnouncement } from '../../../socket/index.js';
import { validateBody, validateParams } from '../middleware/validate.js';

const competitionParams = z.object({ competitionId: z.string().min(1) });
const annParams = z.object({ competitionId: z.string().min(1), id: z.string().min(1) });
const annBody = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  isLive: z.boolean().optional(),
  expiresAt: z.string().datetime().optional(),
});

export const list = [
  validateParams(competitionParams),
  asyncHandler(async (req: Request, res: Response) => {
    const liveOnly = req.query.live === 'true';
    const items = await announcementService.listAnnouncements(req.params.competitionId, liveOnly);
    sendSuccess(res, items);
  }),
];

export const create = [
  validateParams(competitionParams),
  validateBody(annBody),
  asyncHandler(async (req: Request, res: Response) => {
    const ann = await announcementService.createAnnouncement(req.params.competitionId, {
      ...req.body,
      expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
      createdById: req.user!.id,
    });
    emitAnnouncement(req.params.competitionId, {
      title: ann.title,
      body: ann.body,
      priority: ann.priority,
    });
    sendSuccess(res, ann, 201);
  }),
];

export const update = [
  validateParams(annParams),
  asyncHandler(async (req: Request, res: Response) => {
    const ann = await announcementService.updateAnnouncement(
      req.params.competitionId,
      req.params.id,
      req.body,
    );
    sendSuccess(res, ann);
  }),
];

export const remove = [
  validateParams(annParams),
  asyncHandler(async (req: Request, res: Response) => {
    await announcementService.deleteAnnouncement(req.params.competitionId, req.params.id);
    sendSuccess(res, { deleted: true });
  }),
];

import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler, AppError } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import * as eventFeedService from '../../../services/event-feed.service.js';

const competitionParams = z.object({ competitionId: z.string().min(1) });
const itemParams = competitionParams.extend({ itemId: z.string().min(1) });

const textBody = z.object({
  body: z.string().trim().min(1).max(1000),
});

const scoreBody = z.object({
  pilotId: z.string().min(1),
  scoreText: z.string().trim().min(1).max(120),
});

export const listFeed = [
  validateParams(competitionParams),
  asyncHandler(async (req: Request, res: Response) => {
    const items = await eventFeedService.listFeed(req.params.competitionId);
    sendSuccess(res, items);
  }),
];

export const createText = [
  validateParams(competitionParams),
  validateBody(textBody),
  asyncHandler(async (req: Request, res: Response) => {
    const item = await eventFeedService.createTextPost(
      req.params.competitionId,
      req.user?.id,
      req.body,
    );
    sendSuccess(res, item, 201);
  }),
];

export const createScore = [
  validateParams(competitionParams),
  validateBody(scoreBody),
  asyncHandler(async (req: Request, res: Response) => {
    const item = await eventFeedService.createScorePost(
      req.params.competitionId,
      req.user?.id,
      req.body,
    );
    sendSuccess(res, item, 201);
  }),
];

export const createPhoto = [
  validateParams(competitionParams),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw AppError.badRequest('Photo is required');
    const caption = z.string().trim().min(1).max(1000).safeParse(req.body?.caption);
    if (!caption.success) {
      throw AppError.badRequest('Caption is required');
    }
    const item = await eventFeedService.createPhotoPost(
      req.params.competitionId,
      req.user?.id,
      req.file,
      caption.data,
    );
    sendSuccess(res, item, 201);
  }),
];

export const deleteFeedItem = [
  validateParams(itemParams),
  asyncHandler(async (req: Request, res: Response) => {
    await eventFeedService.deleteFeedItem(req.params.competitionId, req.params.itemId);
    sendSuccess(res, { deleted: true });
  }),
];

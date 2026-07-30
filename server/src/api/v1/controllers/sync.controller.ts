import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import * as syncService from '../../../services/sync.service.js';
import { validateBody, validateParams } from '../middleware/validate.js';

const enqueueBody = z.object({
  clientId: z.string().min(1),
  operation: z.string().min(1),
  payloadJson: z.record(z.unknown()),
});

const clientParams = z.object({ clientId: z.string().min(1) });
const itemParams = z.object({ id: z.string().min(1) });

export const enqueue = [
  validateBody(enqueueBody),
  asyncHandler(async (req: Request, res: Response) => {
    const item = await syncService.enqueueSyncItem(req.user!.id, req.body);
    sendSuccess(res, item, 201);
  }),
];

export const pending = asyncHandler(async (req: Request, res: Response) => {
  const items = await syncService.listPendingSync(req.user!.id);
  sendSuccess(res, items);
});

export const processBatch = [
  validateParams(clientParams),
  asyncHandler(async (req: Request, res: Response) => {
    const results = await syncService.processSyncBatch(req.user!.id, req.params.clientId);
    sendSuccess(res, results);
  }),
];

export const markSynced = [
  validateParams(itemParams),
  asyncHandler(async (req: Request, res: Response) => {
    const item = await syncService.markSynced(req.params.id, req.user!.id);
    sendSuccess(res, item);
  }),
];

export const markFailed = [
  validateParams(itemParams),
  validateBody(z.object({ error: z.string().min(1) })),
  asyncHandler(async (req: Request, res: Response) => {
    const item = await syncService.markFailed(req.params.id, req.user!.id, req.body.error);
    sendSuccess(res, item);
  }),
];

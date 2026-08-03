import type { Request, Response } from 'express';
import { createOfficialSchema, updateOfficialSchema } from '@npha/shared';
import { z } from 'zod';
import { asyncHandler } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import * as officialService from '../../../services/official.service.js';
import { validateBody, validateParams } from '../middleware/validate.js';

const competitionParams = z.object({ competitionId: z.string().min(1) });
const officialParams = z.object({
  competitionId: z.string().min(1),
  officialId: z.string().min(1),
});

export const list = [
  validateParams(competitionParams),
  asyncHandler(async (req: Request, res: Response) => {
    const officials = await officialService.listOfficials(req.params.competitionId);
    sendSuccess(res, officials);
  }),
];

export const create = [
  validateParams(competitionParams),
  validateBody(createOfficialSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const official = await officialService.createOfficial(req.params.competitionId, req.body);
    sendSuccess(res, official, 201);
  }),
];

export const update = [
  validateParams(officialParams),
  validateBody(updateOfficialSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const official = await officialService.updateOfficial(
      req.params.competitionId,
      req.params.officialId,
      req.body,
    );
    sendSuccess(res, official);
  }),
];

export const remove = [
  validateParams(officialParams),
  asyncHandler(async (req: Request, res: Response) => {
    await officialService.deleteOfficial(req.params.competitionId, req.params.officialId);
    sendSuccess(res, { deleted: true });
  }),
];

export const uploadPhoto = [
  validateParams(officialParams),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: { message: 'Photo file required', code: 'BAD_REQUEST' },
      });
      return;
    }
    const official = await officialService.uploadOfficialPhoto(
      req.params.competitionId,
      req.params.officialId,
      req.file,
    );
    sendSuccess(res, official);
  }),
];

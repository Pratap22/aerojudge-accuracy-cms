import type { Request, Response } from 'express';
import { createSponsorSchema, updateSponsorSchema } from '@npha/shared';
import multer from 'multer';
import { z } from 'zod';
import { asyncHandler } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import * as sponsorService from '../../../services/sponsor.service.js';
import { emitSponsorsUpdated } from '../../../socket/index.js';
import { validateBody, validateParams } from '../middleware/validate.js';

const competitionParams = z.object({ competitionId: z.string().min(1) });
const sponsorParams = z.object({
  competitionId: z.string().min(1),
  sponsorId: z.string().min(1),
});

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const list = [
  validateParams(competitionParams),
  asyncHandler(async (req: Request, res: Response) => {
    const sponsors = await sponsorService.listSponsors(req.params.competitionId);
    sendSuccess(res, sponsors);
  }),
];

export const create = [
  validateParams(competitionParams),
  validateBody(createSponsorSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const sponsor = await sponsorService.createSponsor(req.params.competitionId, req.body);
    emitSponsorsUpdated(req.params.competitionId);
    sendSuccess(res, sponsor, 201);
  }),
];

export const update = [
  validateParams(sponsorParams),
  validateBody(updateSponsorSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const sponsor = await sponsorService.updateSponsor(
      req.params.competitionId,
      req.params.sponsorId,
      req.body,
    );
    emitSponsorsUpdated(req.params.competitionId);
    sendSuccess(res, sponsor);
  }),
];

export const remove = [
  validateParams(sponsorParams),
  asyncHandler(async (req: Request, res: Response) => {
    await sponsorService.deleteSponsor(req.params.competitionId, req.params.sponsorId);
    emitSponsorsUpdated(req.params.competitionId);
    sendSuccess(res, { deleted: true });
  }),
];

export const uploadLogo = [
  validateParams(sponsorParams),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ success: false, error: { message: 'Logo file required', code: 'BAD_REQUEST' } });
      return;
    }
    const sponsor = await sponsorService.uploadSponsorLogo(
      req.params.competitionId,
      req.params.sponsorId,
      req.file,
    );
    emitSponsorsUpdated(req.params.competitionId);
    sendSuccess(res, sponsor);
  }),
];

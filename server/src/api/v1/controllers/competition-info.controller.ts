import type { Request, Response } from 'express';
import {
  createCompetitionContactSchema,
  createCompetitionLinkSchema,
  createGalleryImageSchema,
  updateCompetitionContactSchema,
  updateCompetitionInfoSchema,
  updateCompetitionLinkSchema,
  updateGalleryImageSchema,
} from '@npha/shared';
import { z } from 'zod';
import { asyncHandler } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import * as infoService from '../../../services/competition-info.service.js';
import { validateBody, validateParams } from '../middleware/validate.js';

const competitionParams = z.object({ competitionId: z.string().min(1) });
const imageParams = z.object({
  competitionId: z.string().min(1),
  imageId: z.string().min(1),
});
const linkParams = z.object({
  competitionId: z.string().min(1),
  linkId: z.string().min(1),
});
const contactParams = z.object({
  competitionId: z.string().min(1),
  contactId: z.string().min(1),
});

export const get = [
  validateParams(competitionParams),
  asyncHandler(async (req: Request, res: Response) => {
    const info = await infoService.getEventInfo(req.params.competitionId);
    sendSuccess(res, info);
  }),
];

export const update = [
  validateParams(competitionParams),
  validateBody(updateCompetitionInfoSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const info = await infoService.updateEventInfo(req.params.competitionId, req.body);
    sendSuccess(res, info);
  }),
];

export const uploadGalleryImage = [
  validateParams(competitionParams),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: { message: 'Image file required', code: 'BAD_REQUEST' },
      });
      return;
    }
    const caption =
      typeof req.body?.caption === 'string' && req.body.caption.trim()
        ? req.body.caption.trim()
        : undefined;
    const parsed = createGalleryImageSchema.parse({ caption });
    const image = await infoService.createGalleryImage(
      req.params.competitionId,
      req.file,
      parsed,
    );
    sendSuccess(res, image, 201);
  }),
];

export const updateGalleryImage = [
  validateParams(imageParams),
  validateBody(updateGalleryImageSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const image = await infoService.updateGalleryImage(
      req.params.competitionId,
      req.params.imageId,
      req.body,
    );
    sendSuccess(res, image);
  }),
];

export const removeGalleryImage = [
  validateParams(imageParams),
  asyncHandler(async (req: Request, res: Response) => {
    await infoService.deleteGalleryImage(req.params.competitionId, req.params.imageId);
    sendSuccess(res, { deleted: true });
  }),
];

export const createLink = [
  validateParams(competitionParams),
  validateBody(createCompetitionLinkSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const link = await infoService.createLink(req.params.competitionId, req.body);
    sendSuccess(res, link, 201);
  }),
];

export const updateLink = [
  validateParams(linkParams),
  validateBody(updateCompetitionLinkSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const link = await infoService.updateLink(
      req.params.competitionId,
      req.params.linkId,
      req.body,
    );
    sendSuccess(res, link);
  }),
];

export const removeLink = [
  validateParams(linkParams),
  asyncHandler(async (req: Request, res: Response) => {
    await infoService.deleteLink(req.params.competitionId, req.params.linkId);
    sendSuccess(res, { deleted: true });
  }),
];

export const createContact = [
  validateParams(competitionParams),
  validateBody(createCompetitionContactSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const contact = await infoService.createContact(req.params.competitionId, req.body);
    sendSuccess(res, contact, 201);
  }),
];

export const updateContact = [
  validateParams(contactParams),
  validateBody(updateCompetitionContactSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const contact = await infoService.updateContact(
      req.params.competitionId,
      req.params.contactId,
      req.body,
    );
    sendSuccess(res, contact);
  }),
];

export const removeContact = [
  validateParams(contactParams),
  asyncHandler(async (req: Request, res: Response) => {
    await infoService.deleteContact(req.params.competitionId, req.params.contactId);
    sendSuccess(res, { deleted: true });
  }),
];

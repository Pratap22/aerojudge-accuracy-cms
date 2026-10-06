import type { Request, Response } from 'express';
import { createProtestSchema, updateProtestSchema } from '@aero-judge/shared';
import { z } from 'zod';
import { asyncHandler, AppError } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import * as protestService from '../../../services/protest.service.js';
import { auditFromRequest, writeAuditLog } from '../middleware/audit.js';
import { validateBody, validateParams } from '../middleware/validate.js';

const competitionParams = z.object({ competitionId: z.string().min(1) });
const protestParams = z.object({
  competitionId: z.string().min(1),
  protestId: z.string().min(1),
});

export const list = [
  validateParams(competitionParams),
  asyncHandler(async (req: Request, res: Response) => {
    const protests = await protestService.listProtests(req.params.competitionId);
    sendSuccess(res, protests);
  }),
];

export const create = [
  validateParams(competitionParams),
  validateBody(createProtestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const protest = await protestService.createProtest(req.params.competitionId, req.body, {
      actorUserId: req.user?.id,
    });
    await writeAuditLog({
      ...auditFromRequest(req),
      competitionId: req.params.competitionId,
      action: 'CREATE',
      entityType: 'Protest',
      entityId: protest.id,
      after: protest,
    });
    sendSuccess(res, protest, 201);
  }),
];

export const update = [
  validateParams(protestParams),
  validateBody(updateProtestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const before = await protestService.getProtest(req.params.competitionId, req.params.protestId);
    const protest = await protestService.updateProtest(
      req.params.competitionId,
      req.params.protestId,
      req.body,
    );
    await writeAuditLog({
      ...auditFromRequest(req),
      competitionId: req.params.competitionId,
      action: 'UPDATE',
      entityType: 'Protest',
      entityId: protest.id,
      before,
      after: protest,
    });
    sendSuccess(res, protest);
  }),
];

export const remove = [
  validateParams(protestParams),
  asyncHandler(async (req: Request, res: Response) => {
    const before = await protestService.getProtest(req.params.competitionId, req.params.protestId);
    await protestService.deleteProtest(req.params.competitionId, req.params.protestId);
    await writeAuditLog({
      ...auditFromRequest(req),
      competitionId: req.params.competitionId,
      action: 'DELETE',
      entityType: 'Protest',
      entityId: before.id,
      before,
    });
    sendSuccess(res, { deleted: true });
  }),
];

export const downloadForm = [
  validateParams(protestParams),
  asyncHandler(async (req: Request, res: Response) => {
    const file = await protestService.readProtestForm(
      req.params.competitionId,
      req.params.protestId,
    );
    const filename = file.filename.replace(/[\r\n"]/g, '');
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', file.body.length);
    res.send(file.body);
  }),
];

export const uploadForm = [
  validateParams(protestParams),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw AppError.badRequest('Signed protest form is required');
    const before = await protestService.getProtest(req.params.competitionId, req.params.protestId);
    const protest = await protestService.uploadProtestForm(
      req.params.competitionId,
      req.params.protestId,
      req.file,
    );
    await writeAuditLog({
      ...auditFromRequest(req),
      competitionId: req.params.competitionId,
      action: 'UPDATE',
      entityType: 'Protest',
      entityId: protest.id,
      before,
      after: protest,
    });
    sendSuccess(res, protest);
  }),
];

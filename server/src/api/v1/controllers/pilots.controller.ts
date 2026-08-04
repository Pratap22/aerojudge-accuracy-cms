import type { Request, Response } from 'express';
import {
  createPilotSchema,
  paginationSchema,
  pilotStatusSchema,
  updatePilotSchema,
  updatePilotStatusSchema,
} from '@npha/shared';
import { z } from 'zod';
import { asyncHandler } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import * as pilotService from '../../../services/pilot.service.js';
import { auditFromRequest, writeAuditLog } from '../middleware/audit.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';

const competitionParams = z.object({ competitionId: z.string().min(1) });
const pilotParams = z.object({ competitionId: z.string().min(1), pilotId: z.string().min(1) });
const searchQuery = z.object({ q: z.string().min(1), limit: z.coerce.number().int().min(1).max(50).optional() });
const qrParams = z.object({ competitionId: z.string().min(1), code: z.string().min(1) });
const listQuery = paginationSchema.extend({
  status: pilotStatusSchema.optional(),
});

export const list = [
  validateParams(competitionParams),
  validateQuery(listQuery),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await pilotService.listPilots(req.params.competitionId, req.query as never);
    sendSuccess(res, result.items, 200, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    });
  }),
];

export const get = [
  validateParams(pilotParams),
  asyncHandler(async (req: Request, res: Response) => {
    const pilot = await pilotService.getPilot(req.params.competitionId, req.params.pilotId);
    sendSuccess(res, pilot);
  }),
];

export const create = [
  validateParams(competitionParams),
  validateBody(createPilotSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const pilot = await pilotService.createPilot(
      req.params.competitionId,
      {
        ...req.body,
        dateOfBirth: req.body.dateOfBirth ? new Date(req.body.dateOfBirth) : undefined,
      },
      { actorUserId: req.user?.id },
    );
    await writeAuditLog({
      ...auditFromRequest(req),
      competitionId: req.params.competitionId,
      action: 'CREATE',
      entityType: 'Pilot',
      entityId: pilot.id,
      after: pilot,
    });
    sendSuccess(res, pilot, 201);
  }),
];

export const update = [
  validateParams(pilotParams),
  validateBody(updatePilotSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const pilot = await pilotService.updatePilot(
      req.params.competitionId,
      req.params.pilotId,
      {
        ...req.body,
        dateOfBirth: req.body.dateOfBirth ? new Date(req.body.dateOfBirth) : req.body.dateOfBirth,
      },
    );
    await writeAuditLog({
      ...auditFromRequest(req),
      competitionId: req.params.competitionId,
      action: 'UPDATE',
      entityType: 'Pilot',
      entityId: pilot.id,
      after: pilot,
    });
    sendSuccess(res, pilot);
  }),
];

export const updateStatus = [
  validateParams(pilotParams),
  validateBody(updatePilotStatusSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const pilot = await pilotService.setPilotStatus(
      req.params.competitionId,
      req.params.pilotId,
      req.body.status,
    );
    await writeAuditLog({
      ...auditFromRequest(req),
      competitionId: req.params.competitionId,
      action: 'UPDATE',
      entityType: 'Pilot',
      entityId: pilot.id,
      after: { status: pilot.status },
    });
    sendSuccess(res, pilot);
  }),
];

export const accept = [
  validateParams(pilotParams),
  asyncHandler(async (req: Request, res: Response) => {
    const pilot = await pilotService.acceptPilot(req.params.competitionId, req.params.pilotId);
    await writeAuditLog({
      ...auditFromRequest(req),
      competitionId: req.params.competitionId,
      action: 'UPDATE',
      entityType: 'Pilot',
      entityId: pilot.id,
      after: { status: pilot.status, decision: 'ACCEPTED' },
    });
    sendSuccess(res, pilot);
  }),
];

export const reject = [
  validateParams(pilotParams),
  asyncHandler(async (req: Request, res: Response) => {
    const pilot = await pilotService.rejectPilot(req.params.competitionId, req.params.pilotId);
    await writeAuditLog({
      ...auditFromRequest(req),
      competitionId: req.params.competitionId,
      action: 'UPDATE',
      entityType: 'Pilot',
      entityId: pilot.id,
      after: { status: pilot.status, decision: 'REJECTED' },
    });
    sendSuccess(res, pilot);
  }),
];

export const remove = [
  validateParams(pilotParams),
  asyncHandler(async (req: Request, res: Response) => {
    const before = await pilotService.getPilot(req.params.competitionId, req.params.pilotId);
    await pilotService.deletePilot(req.params.competitionId, req.params.pilotId, {
      actorUserId: req.user?.id,
    });
    await writeAuditLog({
      ...auditFromRequest(req),
      competitionId: req.params.competitionId,
      action: 'DELETE',
      entityType: 'Pilot',
      entityId: req.params.pilotId,
      before: {
        id: before.id,
        pilotNumber: before.pilotNumber,
        firstName: before.firstName,
        lastName: before.lastName,
        status: before.status,
        personId: before.personId,
      },
    });
    sendSuccess(res, { deleted: true });
  }),
];

export const search = [
  validateParams(competitionParams),
  validateQuery(searchQuery),
  asyncHandler(async (req: Request, res: Response) => {
    const pilots = await pilotService.searchPilots(
      req.params.competitionId,
      req.query.q as string,
      req.query.limit as number | undefined,
    );
    sendSuccess(res, pilots);
  }),
];

export const qrLookup = [
  validateParams(qrParams),
  asyncHandler(async (req: Request, res: Response) => {
    const pilot = await pilotService.getPilotByQr(req.params.competitionId, req.params.code);
    sendSuccess(res, pilot);
  }),
];

export const importCsv = [
  validateParams(competitionParams),
  asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, error: { code: 'NO_FILE', message: 'CSV file required' } });
      return;
    }
    const result = await pilotService.importPilotsFromCsv(
      req.params.competitionId,
      file.buffer.toString('utf-8'),
    );
    sendSuccess(res, result, 201);
  }),
];

export const exportCsv = [
  validateParams(competitionParams),
  asyncHandler(async (req: Request, res: Response) => {
    const csv = await pilotService.exportPilotsCsv(req.params.competitionId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="pilots-${req.params.competitionId}.csv"`,
    );
    res.status(200).send(csv);
  }),
];

export const uploadPhoto = [
  validateParams(pilotParams),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: { message: 'Photo file required', code: 'BAD_REQUEST' },
      });
      return;
    }
    const pilot = await pilotService.uploadPilotPhoto(
      req.params.competitionId,
      req.params.pilotId,
      req.file,
    );
    sendSuccess(res, pilot);
  }),
];

export const removePhoto = [
  validateParams(pilotParams),
  asyncHandler(async (req: Request, res: Response) => {
    const pilot = await pilotService.removePilotPhoto(
      req.params.competitionId,
      req.params.pilotId,
    );
    sendSuccess(res, pilot);
  }),
];

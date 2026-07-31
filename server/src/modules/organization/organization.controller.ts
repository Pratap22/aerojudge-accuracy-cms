import type { Request, Response } from 'express';
import multer from 'multer';
import {
  createOrganizationSchema,
  listOrganizationsQuerySchema,
  organizationSettingsSchema,
  paginationSchema,
  updateOrganizationSchema,
  updateOrganizationStatusSchema,
} from '@npha/shared';
import { z } from 'zod';
import { asyncHandler, AppError } from '../../utils/errors.js';
import { sendSuccess } from '../../utils/response.js';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../api/v1/middleware/validate.js';
import { auditFromRequest, writeAuditLog } from '../../api/v1/middleware/audit.js';
import { organizationService } from './organization.service.js';

const idParams = z.object({ id: z.string().min(1) });

/** Multer memory storage for organization logo uploads. */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

/**
 * GET /organizations — paginated list.
 */
export const list = [
  validateQuery(listOrganizationsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await organizationService.list(req.query as never);
    sendSuccess(res, result.items, 200, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    });
  }),
];

/**
 * GET /organizations/:id — detail with settings and counts.
 */
export const get = [
  validateParams(idParams),
  asyncHandler(async (req: Request, res: Response) => {
    const org = await organizationService.getById(req.params.id);
    sendSuccess(res, org);
  }),
];

/**
 * POST /organizations — create.
 */
export const create = [
  validateBody(createOrganizationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const org = await organizationService.create(req.body);
    await writeAuditLog({
      ...auditFromRequest(req),
      action: 'ORGANIZATION_CREATE',
      entityType: 'Organization',
      entityId: org.id,
      after: { id: org.id, slug: org.slug, name: org.name },
    });
    sendSuccess(res, org, 201);
  }),
];

/**
 * PUT /organizations/:id — full/partial update.
 */
export const update = [
  validateParams(idParams),
  validateBody(updateOrganizationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const org = await organizationService.update(req.params.id, req.body);
    await writeAuditLog({
      ...auditFromRequest(req),
      action: 'ORGANIZATION_UPDATE',
      entityType: 'Organization',
      entityId: org.id,
      after: req.body,
    });
    sendSuccess(res, org);
  }),
];

/**
 * PATCH /organizations/:id/status — activate / deactivate / archive.
 */
export const updateStatus = [
  validateParams(idParams),
  validateBody(updateOrganizationStatusSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const org = await organizationService.updateStatus(req.params.id, req.body);
    await writeAuditLog({
      ...auditFromRequest(req),
      action: 'ORGANIZATION_STATUS',
      entityType: 'Organization',
      entityId: org.id,
      after: { status: org.status, isActive: org.isActive },
    });
    sendSuccess(res, org);
  }),
];

/**
 * PUT /organizations/:id/settings — settings JSON blobs.
 */
export const updateSettings = [
  validateParams(idParams),
  validateBody(organizationSettingsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const org = await organizationService.updateSettings(req.params.id, req.body);
    await writeAuditLog({
      ...auditFromRequest(req),
      action: 'ORGANIZATION_SETTINGS',
      entityType: 'Organization',
      entityId: req.params.id,
      after: req.body,
    });
    sendSuccess(res, org);
  }),
];

/**
 * POST /organizations/:id/logo — multipart logo upload.
 */
export const uploadLogo = [
  validateParams(idParams),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw AppError.badRequest('Logo file is required');
    const org = await organizationService.uploadLogo(req.params.id, req.file);
    await writeAuditLog({
      ...auditFromRequest(req),
      action: 'ORGANIZATION_LOGO',
      entityType: 'Organization',
      entityId: org.id,
      after: { logoUrl: org.logoUrl },
    });
    sendSuccess(res, org);
  }),
];

/**
 * GET /organizations/:id/competitions — competitions owned by org.
 */
export const listCompetitions = [
  validateParams(idParams),
  validateQuery(paginationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await organizationService.listCompetitions(req.params.id, req.query as never);
    sendSuccess(res, result.items, 200, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    });
  }),
];

import type { Request, Response } from 'express';
import {
  createUserSchema,
  paginationSchema,
  setUserPasswordSchema,
  updateUserSchema,
} from '@npha/shared';
import { z } from 'zod';
import { asyncHandler } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import * as userService from '../../../services/user.service.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';
import { auditFromRequest, writeAuditLog } from '../middleware/audit.js';

const idParams = z.object({ id: z.string().min(1) });

export const list = [
  validateQuery(paginationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await userService.listUsers(req.query as never);
    sendSuccess(res, result.items, 200, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    });
  }),
];

export const get = [
  validateParams(idParams),
  asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.getUser(req.params.id);
    sendSuccess(res, user);
  }),
];

export const create = [
  validateBody(createUserSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.createUser(req.body);
    await writeAuditLog({
      ...auditFromRequest(req),
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: user.id,
      after: { email: user.email, role: user.role },
    });
    sendSuccess(res, user, 201);
  }),
];

export const update = [
  validateParams(idParams),
  validateBody(updateUserSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const before = await userService.getUser(req.params.id);
    const user = await userService.updateUser(req.params.id, req.body);
    await writeAuditLog({
      ...auditFromRequest(req),
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: user.id,
      before: { email: before.email, role: before.role, status: before.status },
      after: { email: user.email, role: user.role, status: user.status },
    });
    sendSuccess(res, user);
  }),
];

export const setPassword = [
  validateParams(idParams),
  validateBody(setUserPasswordSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const target = await userService.getUser(req.params.id);
    await userService.setUserPassword(req.params.id, req.body.password);
    await writeAuditLog({
      ...auditFromRequest(req),
      action: 'USER_PASSWORD_SET',
      entityType: 'User',
      entityId: target.id,
      after: { email: target.email, sessionsRevoked: true },
    });
    sendSuccess(res, { updated: true });
  }),
];

export const remove = [
  validateParams(idParams),
  asyncHandler(async (req: Request, res: Response) => {
    const before = await userService.getUser(req.params.id);
    await userService.deleteUser(req.params.id);
    await writeAuditLog({
      ...auditFromRequest(req),
      action: 'USER_DEACTIVATED',
      entityType: 'User',
      entityId: before.id,
      before: { email: before.email, status: before.status },
      after: { status: 'INACTIVE' },
    });
    sendSuccess(res, { deleted: true });
  }),
];

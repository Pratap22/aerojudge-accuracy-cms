import type { Request, Response } from 'express';
import { createUserSchema, paginationSchema } from '@npha/shared';
import { z } from 'zod';
import { asyncHandler } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import * as userService from '../../../services/user.service.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';

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
    sendSuccess(res, user, 201);
  }),
];

export const update = [
  validateParams(idParams),
  asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.updateUser(req.params.id, req.body);
    sendSuccess(res, user);
  }),
];

export const remove = [
  validateParams(idParams),
  asyncHandler(async (req: Request, res: Response) => {
    await userService.deleteUser(req.params.id);
    sendSuccess(res, { deleted: true });
  }),
];

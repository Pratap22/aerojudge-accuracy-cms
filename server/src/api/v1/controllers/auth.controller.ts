import type { Request, Response } from 'express';
import { loginSchema } from '@npha/shared';
import { z } from 'zod';
import { asyncHandler } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import * as authService from '../../../services/auth.service.js';
import { validateBody } from '../middleware/validate.js';

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

export const login = [
  validateBody(loginSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login(req.body.email, req.body.password, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    sendSuccess(res, result);
  }),
];

export const refresh = [
  validateBody(refreshSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const tokens = await authService.refresh(req.body.refreshToken);
    sendSuccess(res, { tokens });
  }),
];

export const logout = [
  validateBody(refreshSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await authService.logout(req.body.refreshToken);
    sendSuccess(res, { message: 'Logged out' });
  }),
];

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getMe(req.user!.id);
  sendSuccess(res, user);
});

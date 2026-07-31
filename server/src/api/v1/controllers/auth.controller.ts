import type { Request, Response } from 'express';
import { loginSchema, selectOrganizationSchema } from '@npha/shared';
import { z } from 'zod';
import { asyncHandler } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import * as authService from '../../../services/auth.service.js';
import { validateBody } from '../middleware/validate.js';

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
  organizationId: z.string().min(1).optional(),
});

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

export const selectOrganization = [
  validateBody(selectOrganizationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const refreshHeader = req.headers['x-refresh-token'];
    const refreshToken = Array.isArray(refreshHeader) ? refreshHeader[0] : refreshHeader;
    const result = await authService.selectOrganization(
      req.user!.id,
      req.body.organizationId,
      refreshToken,
    );
    sendSuccess(res, result);
  }),
];

export const refresh = [
  validateBody(refreshSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.refresh(req.body.refreshToken, req.body.organizationId);
    // Backward-compatible envelope: { tokens } plus user when present
    sendSuccess(res, {
      tokens: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
      },
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    });
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
  const user = await authService.getMe(req.user!.id, req.organizationId ?? req.user?.organizationId);
  sendSuccess(res, user);
});

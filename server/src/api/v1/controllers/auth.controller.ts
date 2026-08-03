import type { Request, Response } from 'express';
import {
  claimPersonByIdentitySchema,
  loginSchema,
  registerParticipantSchema,
} from '@npha/shared';
import { z } from 'zod';
import { asyncHandler } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import * as authService from '../../../services/auth.service.js';
import * as personService from '../../../services/person.service.js';
import { validateBody, validateQuery } from '../middleware/validate.js';

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
  organizationId: z.string().min(1).optional(),
});

const claimLookupQuery = z.object({
  aeroJudgeId: z.string().optional(),
  civlId: z.string().optional(),
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

export const registerParticipant = [
  validateBody(registerParticipantSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.registerParticipant(req.body, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    sendSuccess(res, result, 201);
  }),
];

export const selectOrganization = [
  validateBody(z.object({ organizationId: z.string().min(1) })),
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

export const claimLookup = [
  validateQuery(claimLookupQuery),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as { aeroJudgeId?: string; civlId?: string };
    const result = await personService.lookupPersonForClaim(req.user!.id, q);
    sendSuccess(res, result);
  }),
];

export const claimPerson = [
  validateBody(claimPersonByIdentitySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await personService.claimPersonByVerifiedEmail(req.user!.id, req.body);
    sendSuccess(res, result);
  }),
];

import type { Request, Response } from 'express';
import { z } from 'zod';
import { SYSTEM_ORG_ROLE_DEFINITIONS, mapLegacyRoleToOrgRole, type OrgRole } from '@npha/shared';
import { asyncHandler } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import * as printService from '../../../services/print.service.js';
import { validateBody, validateParams } from '../middleware/validate.js';

const competitionParams = z.object({ competitionId: z.string().min(1) });
const printParams = z.object({ competitionId: z.string().min(1), printId: z.string().min(1) });

const generateBody = z.object({
  reportType: z.enum([
    'OVERALL_RESULTS',
    'ROUND_RESULTS',
    'TEAM_RESULTS',
    'COUNTRY_RESULTS',
    'WOMEN_RESULTS',
    'LAUNCH_ORDER',
    'PILOT_LIST',
    'REGISTRATION_LIST',
    'JUDGE_SHEETS',
    'PILOT_CARDS',
    'CERTIFICATES',
    'STATISTICS',
    'AUDIT_REPORT',
  ]),
  format: z
    .enum(['A4_PORTRAIT', 'A4_LANDSCAPE', 'LETTER_PORTRAIT', 'LETTER_LANDSCAPE'])
    .optional(),
  roundId: z.string().optional(),
});

export const list = [
  validateParams(competitionParams),
  asyncHandler(async (req: Request, res: Response) => {
    const history = await printService.listPrintHistory(req.params.competitionId);
    sendSuccess(res, history);
  }),
];

export const preview = [
  validateParams(competitionParams),
  validateBody(generateBody),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await printService.previewReport(req.params.competitionId, {
      ...req.body,
      printedById: req.user!.id,
    });
    sendSuccess(res, result);
  }),
];

export const generate = [
  validateParams(competitionParams),
  validateBody(generateBody),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await printService.generateReport(req.params.competitionId, {
      ...req.body,
      printedById: req.user!.id,
    });
    sendSuccess(res, { print: result.print, filename: result.filename }, 201);
  }),
];

export const download = [
  validateParams(printParams),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await printService.downloadReport(
      req.params.competitionId,
      req.params.printId,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.buffer);
  }),
];

export const approve = [
  validateParams(printParams),
  asyncHandler(async (req: Request, res: Response) => {
    const orgRole =
      req.user!.orgRole ??
      (req.user!.role ? mapLegacyRoleToOrgRole(req.user!.role) : null);
    const roleLabel =
      (orgRole && SYSTEM_ORG_ROLE_DEFINITIONS[orgRole as OrgRole]?.name) ||
      'Meet Director';

    const record = await printService.approvePrint(
      req.params.competitionId,
      req.params.printId,
      { userId: req.user!.id, roleLabel },
    );
    sendSuccess(res, record);
  }),
];

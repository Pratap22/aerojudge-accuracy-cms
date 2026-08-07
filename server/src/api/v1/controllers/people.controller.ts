import type { Request, Response } from 'express';
import {
  createPersonSchema,
  linkUserToPersonSchema,
  matchPersonSchema,
  mergePersonSchema,
  paginationSchema,
  requestProfileClaimSchema,
  updatePersonSchema,
} from '@npha/shared';
import { z } from 'zod';
import { asyncHandler, AppError } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import * as personService from '../../../services/person.service.js';
import { auditFromRequest, writeAuditLog } from '../middleware/audit.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';

const idParams = z.object({ personId: z.string().min(1) });
const claimIdParams = z.object({ claimId: z.string().min(1) });
const ajParams = z.object({ aeroJudgeId: z.string().min(1) });
const searchQuery = paginationSchema.extend({
  q: z.string().optional(),
  civlId: z.string().optional(),
  aeroJudgeId: z.string().optional(),
});
const rejectClaimBody = z.object({
  notes: z.string().max(500).optional(),
});

export const search = [
  validateQuery(searchQuery),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await personService.searchPeopleDirectory(req.query as never);
    sendSuccess(res, result.items, 200, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    });
  }),
];

export const match = [
  validateBody(matchPersonSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const matches = await personService.matchPersons(req.body);
    sendSuccess(res, { matches, count: matches.length });
  }),
];

export const create = [
  validateBody(createPersonSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const person = await personService.createPerson(req.body, {
      actorUserId: req.user?.id,
    });
    await writeAuditLog({
      ...auditFromRequest(req),
      action: 'CREATE',
      entityType: 'Person',
      entityId: person.id,
      after: personService.toPersonDirectoryView(person),
    });
    sendSuccess(res, personService.toPersonPrivateView(person), 201);
  }),
];

export const get = [
  validateParams(idParams),
  asyncHandler(async (req: Request, res: Response) => {
    const person = await personService.getPerson(req.params.personId);
    sendSuccess(res, personService.toPersonPrivateView(person));
  }),
];

export const update = [
  validateParams(idParams),
  validateBody(updatePersonSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const person = await personService.updatePerson(req.params.personId, req.body, {
      actorUserId: req.user?.id,
    });
    sendSuccess(res, personService.toPersonPrivateView(person));
  }),
];

export const history = [
  validateParams(idParams),
  asyncHandler(async (req: Request, res: Response) => {
    const historyRows = await personService.getPersonCompetitionHistory(req.params.personId);
    sendSuccess(res, historyRows);
  }),
];

export const merge = [
  validateParams(idParams),
  validateBody(mergePersonSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const person = await personService.mergePersons(
      req.params.personId,
      req.body.duplicatePersonId,
      req.user?.id,
    );
    sendSuccess(res, personService.toPersonPrivateView(person));
  }),
];

export const requestClaim = [
  validateParams(idParams),
  validateBody(requestProfileClaimSchema),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) throw AppError.unauthorized();
    const claim = await personService.requestProfileClaim(
      req.params.personId,
      req.user.id,
      req.body.verificationMethod,
    );
    sendSuccess(res, claim, 201);
  }),
];

export const listPendingClaims = [
  asyncHandler(async (_req: Request, res: Response) => {
    const claims = await personService.listPendingProfileClaims();
    sendSuccess(res, claims);
  }),
];

export const approveClaim = [
  validateParams(claimIdParams),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) throw AppError.unauthorized();
    const person = await personService.approveProfileClaim(req.params.claimId, req.user.id);
    await writeAuditLog({
      ...auditFromRequest(req),
      action: 'PROFILE_CLAIM_APPROVED',
      entityType: 'Person',
      entityId: person.id,
      after: personService.toPersonDirectoryView(person),
    });
    sendSuccess(res, personService.toPersonDirectoryView(person));
  }),
];

export const rejectClaim = [
  validateParams(claimIdParams),
  validateBody(rejectClaimBody),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) throw AppError.unauthorized();
    const claim = await personService.rejectProfileClaim(
      req.params.claimId,
      req.user.id,
      req.body.notes,
    );
    sendSuccess(res, claim);
  }),
];

export const linkUser = [
  validateParams(idParams),
  validateBody(linkUserToPersonSchema),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) throw AppError.unauthorized();
    const result = await personService.adminLinkUserToPerson(
      req.params.personId,
      req.body,
      req.user.id,
    );
    await writeAuditLog({
      ...auditFromRequest(req),
      action: 'PROFILE_LINKED_BY_ADMIN',
      entityType: 'Person',
      entityId: req.params.personId,
      after: result,
    });
    sendSuccess(res, result);
  }),
];

export const unlinkUser = [
  validateParams(idParams),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) throw AppError.unauthorized();
    const result = await personService.adminUnlinkUserFromPerson(
      req.params.personId,
      req.user.id,
    );
    sendSuccess(res, result);
  }),
];

export const publicProfile = [
  validateParams(ajParams),
  asyncHandler(async (req: Request, res: Response) => {
    const profile = await personService.getPublicProfile(req.params.aeroJudgeId);
    sendSuccess(res, profile);
  }),
];

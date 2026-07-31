import type { Request, Response } from 'express';
import {
  createOrganizationRoleSchema,
  createOrganizationSchema,
  inviteOrganizationMemberSchema,
  isPlatformRole,
  listOrganizationsQuerySchema,
  organizationSettingsSchema,
  paginationSchema,
  updateOrganizationMemberSchema,
  updateOrganizationRoleSchema,
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
import { organizationMemberService } from './organization-member.service.js';
import { organizationRoleService } from './organization-role.service.js';

const idParams = z.object({ id: z.string().min(1) });
const memberParams = z.object({ id: z.string().min(1), memberId: z.string().min(1) });
const roleParams = z.object({ id: z.string().min(1), roleId: z.string().min(1) });

/**
 * GET /organizations — paginated list (membership-scoped unless platform admin).
 */
export const list = [
  validateQuery(listOrganizationsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const platformAdmin = isPlatformRole(req.user!.role);
    const result = await organizationService.list({
      ...(req.query as Record<string, unknown>),
      memberUserId: platformAdmin ? undefined : req.user!.id,
      platformAdmin,
    } as Parameters<typeof organizationService.list>[0]);
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
    const platformAdmin = isPlatformRole(req.user!.role);
    const org = await organizationService.getById(
      req.params.id,
      platformAdmin ? undefined : req.user!.id,
    );
    sendSuccess(res, org);
  }),
];

/**
 * POST /organizations — create.
 */
export const create = [
  validateBody(createOrganizationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const org = await organizationService.create(req.body, req.user!.id);
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
    const platformAdmin = isPlatformRole(req.user!.role);
    await organizationService.getById(
      req.params.id,
      platformAdmin ? undefined : req.user!.id,
    );
    const result = await organizationService.listCompetitions(req.params.id, req.query as never);
    sendSuccess(res, result.items, 200, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    });
  }),
];

/**
 * GET /organizations/:id/members
 */
export const listMembers = [
  validateParams(idParams),
  validateQuery(paginationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await organizationMemberService.list(req.params.id, req.query as never);
    sendSuccess(res, result.items, 200, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    });
  }),
];

/**
 * POST /organizations/:id/members — invite / add member
 */
export const inviteMember = [
  validateParams(idParams),
  validateBody(inviteOrganizationMemberSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const member = await organizationMemberService.invite(
      req.params.id,
      req.body,
      req.user!.id,
    );
    await writeAuditLog({
      ...auditFromRequest(req),
      action: 'ORGANIZATION_MEMBER_INVITE',
      entityType: 'OrganizationMember',
      entityId: member.id,
      after: { organizationId: req.params.id, userId: member.userId, role: member.role },
    });
    sendSuccess(res, member, 201);
  }),
];

/**
 * PATCH /organizations/:id/members/:memberId
 */
export const updateMember = [
  validateParams(memberParams),
  validateBody(updateOrganizationMemberSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const member = await organizationMemberService.update(
      req.params.id,
      req.params.memberId,
      req.body,
    );
    await writeAuditLog({
      ...auditFromRequest(req),
      action: 'ORGANIZATION_MEMBER_UPDATE',
      entityType: 'OrganizationMember',
      entityId: member.id,
      after: req.body,
    });
    sendSuccess(res, member);
  }),
];

/**
 * DELETE /organizations/:id/members/:memberId — deactivate membership
 */
export const removeMember = [
  validateParams(memberParams),
  asyncHandler(async (req: Request, res: Response) => {
    const member = await organizationMemberService.remove(req.params.id, req.params.memberId);
    await writeAuditLog({
      ...auditFromRequest(req),
      action: 'ORGANIZATION_MEMBER_REMOVE',
      entityType: 'OrganizationMember',
      entityId: member.id,
      after: { status: member.status },
    });
    sendSuccess(res, { removed: true, member });
  }),
];

/**
 * GET /organizations/:id/roles
 */
export const listRoles = [
  validateParams(idParams),
  asyncHandler(async (req: Request, res: Response) => {
    const roles = await organizationRoleService.list(req.params.id);
    sendSuccess(res, roles);
  }),
];

/**
 * POST /organizations/:id/roles
 */
export const createRole = [
  validateParams(idParams),
  validateBody(createOrganizationRoleSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const role = await organizationRoleService.create(req.params.id, req.body);
    await writeAuditLog({
      ...auditFromRequest(req),
      action: 'ORGANIZATION_ROLE_CREATE',
      entityType: 'OrganizationRole',
      entityId: role.id,
      after: { key: role.key, name: role.name, permissions: role.permissions },
    });
    sendSuccess(res, role, 201);
  }),
];

/**
 * PATCH /organizations/:id/roles/:roleId
 */
export const updateRole = [
  validateParams(roleParams),
  validateBody(updateOrganizationRoleSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const role = await organizationRoleService.update(
      req.params.id,
      req.params.roleId,
      req.body,
    );
    await writeAuditLog({
      ...auditFromRequest(req),
      action: 'ORGANIZATION_ROLE_UPDATE',
      entityType: 'OrganizationRole',
      entityId: role.id,
      after: req.body,
    });
    sendSuccess(res, role);
  }),
];

/**
 * DELETE /organizations/:id/roles/:roleId
 */
export const removeRole = [
  validateParams(roleParams),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await organizationRoleService.remove(req.params.id, req.params.roleId);
    await writeAuditLog({
      ...auditFromRequest(req),
      action: 'ORGANIZATION_ROLE_DELETE',
      entityType: 'OrganizationRole',
      entityId: req.params.roleId,
      after: result,
    });
    sendSuccess(res, result);
  }),
];

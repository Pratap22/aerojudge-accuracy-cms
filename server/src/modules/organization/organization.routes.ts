import { Router } from 'express';
import {
  requireAuth,
  requirePermission,
  requirePlatformRole,
  resolveOrganizationContext,
  requireOrgMatchesParam,
} from '../../auth/rbac.js';
import * as ctrl from './organization.controller.js';

/**
 * Organization Management routes.
 * Mounted at /api/v1/organizations
 */
const router = Router();

router.use(requireAuth, resolveOrganizationContext);

router.get('/', ...ctrl.list);
router.post(
  '/',
  requirePlatformRole,
  requirePermission('platform:organizations'),
  ...ctrl.create,
);

router.get('/:id', ...ctrl.get);
router.put(
  '/:id',
  requireOrgMatchesParam('id'),
  requirePermission('organization:manage'),
  ...ctrl.update,
);
router.patch(
  '/:id/status',
  requirePlatformRole,
  requirePermission('platform:organizations'),
  ...ctrl.updateStatus,
);
router.put(
  '/:id/settings',
  requireOrgMatchesParam('id'),
  requirePermission('organization:manage'),
  ...ctrl.updateSettings,
);
router.post(
  '/:id/logo',
  requireOrgMatchesParam('id'),
  requirePermission('organization:manage'),
  ctrl.upload.single('logo'),
  ...ctrl.uploadLogo,
);
router.get('/:id/competitions', ...ctrl.listCompetitions);

router.get(
  '/:id/members',
  requireOrgMatchesParam('id'),
  requirePermission('organization:members'),
  ...ctrl.listMembers,
);
router.post(
  '/:id/members',
  requireOrgMatchesParam('id'),
  requirePermission('organization:members'),
  ...ctrl.inviteMember,
);
router.patch(
  '/:id/members/:memberId',
  requireOrgMatchesParam('id'),
  requirePermission('organization:members'),
  ...ctrl.updateMember,
);
router.delete(
  '/:id/members/:memberId',
  requireOrgMatchesParam('id'),
  requirePermission('organization:members'),
  ...ctrl.removeMember,
);

router.get(
  '/:id/roles',
  requireOrgMatchesParam('id'),
  requirePermission('organization:members'),
  ...ctrl.listRoles,
);
router.post(
  '/:id/roles',
  requireOrgMatchesParam('id'),
  requirePermission('organization:roles'),
  ...ctrl.createRole,
);
router.patch(
  '/:id/roles/:roleId',
  requireOrgMatchesParam('id'),
  requirePermission('organization:roles'),
  ...ctrl.updateRole,
);
router.delete(
  '/:id/roles/:roleId',
  requireOrgMatchesParam('id'),
  requirePermission('organization:roles'),
  ...ctrl.removeRole,
);

export default router;

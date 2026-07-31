import { Router } from 'express';
import { requireAuth, requirePermission } from '../../auth/rbac.js';
import * as ctrl from './organization.controller.js';

/**
 * Organization Management routes.
 * Mounted at /api/v1/organizations
 */
const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('organization:read'), ...ctrl.list);
router.post('/', requirePermission('organization:manage'), ...ctrl.create);

router.get('/:id', requirePermission('organization:read'), ...ctrl.get);
router.put('/:id', requirePermission('organization:manage'), ...ctrl.update);
router.patch(
  '/:id/status',
  requirePermission('organization:manage'),
  ...ctrl.updateStatus,
);
router.put(
  '/:id/settings',
  requirePermission('organization:manage'),
  ...ctrl.updateSettings,
);
router.post(
  '/:id/logo',
  requirePermission('organization:manage'),
  ctrl.upload.single('logo'),
  ...ctrl.uploadLogo,
);
router.get(
  '/:id/competitions',
  requirePermission('organization:read'),
  ...ctrl.listCompetitions,
);

export default router;

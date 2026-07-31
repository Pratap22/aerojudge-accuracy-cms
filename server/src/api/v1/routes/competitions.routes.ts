import { Router } from 'express';
import {
  requireAuth,
  requirePermission,
  resolveOrganizationContext,
  requireOrgContext,
  requireCompetitionInOrg,
} from '../../../auth/rbac.js';
import * as ctrl from '../controllers/competitions.controller.js';

const router = Router();

router.use(requireAuth, resolveOrganizationContext);

router.get('/', ...ctrl.list);
router.post('/', requireOrgContext, requirePermission('competition:create'), ...ctrl.create);
router.get('/:id', requireOrgContext, requireCompetitionInOrg, ...ctrl.get);
router.get('/:id/dashboard', requireOrgContext, requireCompetitionInOrg, ...ctrl.dashboard);
router.delete(
  '/:id',
  requireOrgContext,
  requireCompetitionInOrg,
  requirePermission('competition:delete'),
  ...ctrl.remove,
);
router.patch(
  '/:id/settings',
  requireOrgContext,
  requireCompetitionInOrg,
  requirePermission('competition:update'),
  ...ctrl.updateSettingsHandler,
);
router.put(
  '/:id/settings',
  requireOrgContext,
  requireCompetitionInOrg,
  requirePermission('competition:update'),
  ...ctrl.updateSettingsHandler,
);
router.patch(
  '/:id/rules',
  requireOrgContext,
  requireCompetitionInOrg,
  requirePermission('competition:update'),
  ...ctrl.updateSettingsHandler,
);
router.put(
  '/:id/rules',
  requireOrgContext,
  requireCompetitionInOrg,
  requirePermission('competition:update'),
  ...ctrl.updateSettingsHandler,
);
router.get('/:id/rules', requireOrgContext, requireCompetitionInOrg, ...ctrl.getSettings);
router.get('/:id/settings', requireOrgContext, requireCompetitionInOrg, ...ctrl.getSettings);
router.post(
  '/:id/publish',
  requireOrgContext,
  requireCompetitionInOrg,
  requirePermission('competition:publish'),
  ...ctrl.publish,
);
router.post(
  '/:id/complete',
  requireOrgContext,
  requireCompetitionInOrg,
  requirePermission('competition:update'),
  ...ctrl.complete,
);

export default router;

import { Router } from 'express';
import { requireAuth, requirePermission } from '../../../auth/rbac.js';
import * as ctrl from '../controllers/competitions.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', ...ctrl.list);
router.post('/', requirePermission('competition:create'), ...ctrl.create);
router.get('/:id', ...ctrl.get);
router.get('/:id/dashboard', ...ctrl.dashboard);
router.patch('/:id', requirePermission('competition:update'), ...ctrl.update);
router.put('/:id', requirePermission('competition:update'), ...ctrl.update);
router.delete('/:id', requirePermission('competition:delete'), ...ctrl.remove);
router.patch('/:id/settings', requirePermission('competition:update'), ...ctrl.updateSettingsHandler);
router.put('/:id/settings', requirePermission('competition:update'), ...ctrl.updateSettingsHandler);
router.patch('/:id/rules', requirePermission('competition:update'), ...ctrl.updateSettingsHandler);
router.put('/:id/rules', requirePermission('competition:update'), ...ctrl.updateSettingsHandler);
router.get('/:id/rules', ...ctrl.getSettings);
router.get('/:id/settings', ...ctrl.getSettings);
router.post('/:id/publish', requirePermission('competition:publish'), ...ctrl.publish);

export default router;

import { Router } from 'express';
import { requireAuth, requirePermission } from '../../../auth/rbac.js';
import * as ctrl from '../controllers/sponsors.controller.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get('/', ...ctrl.list);
router.post('/', requirePermission('competition:update'), ...ctrl.create);
router.patch('/:sponsorId', requirePermission('competition:update'), ...ctrl.update);
router.delete('/:sponsorId', requirePermission('competition:update'), ...ctrl.remove);
router.post(
  '/:sponsorId/logo',
  requirePermission('competition:update'),
  ctrl.upload.single('logo'),
  ...ctrl.uploadLogo,
);

export default router;

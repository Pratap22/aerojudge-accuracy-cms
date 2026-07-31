import { Router } from 'express';
import { requireAuth, requirePermission } from '../../../auth/rbac.js';
import { singleFileUpload } from '../../../utils/upload.js';
import * as ctrl from '../controllers/sponsors.controller.js';

const router = Router({ mergeParams: true });

const SPONSOR_LOGO_MAX_BYTES = 5 * 1024 * 1024;

router.use(requireAuth);

router.get('/', ...ctrl.list);
router.post('/', requirePermission('competition:update'), ...ctrl.create);
router.patch('/:sponsorId', requirePermission('competition:update'), ...ctrl.update);
router.delete('/:sponsorId', requirePermission('competition:update'), ...ctrl.remove);
router.post(
  '/:sponsorId/logo',
  requirePermission('competition:update'),
  singleFileUpload('logo', { maxBytes: SPONSOR_LOGO_MAX_BYTES, label: 'Sponsor logo' }),
  ...ctrl.uploadLogo,
);

export default router;

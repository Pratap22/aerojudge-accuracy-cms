import { Router } from 'express';
import { requireAuth, requirePermission } from '../../../auth/rbac.js';
import { singleFileUpload } from '../../../utils/upload.js';
import * as ctrl from '../controllers/officials.controller.js';

const router = Router({ mergeParams: true });

const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

router.use(requireAuth);

router.get('/', ...ctrl.list);
router.post('/', requirePermission('competition:update'), ...ctrl.create);
router.patch('/:officialId', requirePermission('competition:update'), ...ctrl.update);
router.delete('/:officialId', requirePermission('competition:update'), ...ctrl.remove);
router.post(
  '/:officialId/photo',
  requirePermission('competition:update'),
  singleFileUpload('photo', { maxBytes: PHOTO_MAX_BYTES, label: 'Official photo' }),
  ...ctrl.uploadPhoto,
);

export default router;

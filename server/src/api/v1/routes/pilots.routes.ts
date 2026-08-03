import { Router } from 'express';
import { requireAuth, requirePermission } from '../../../auth/rbac.js';
import { env } from '../../../config/env.js';
import { singleFileUpload } from '../../../utils/upload.js';
import * as ctrl from '../controllers/pilots.controller.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get('/', ...ctrl.list);
router.get('/search', ...ctrl.search);
router.get('/qr/:code', ...ctrl.qrLookup);
router.post('/', requirePermission('pilot:manage'), ...ctrl.create);
router.post(
  '/import',
  requirePermission('pilot:manage'),
  singleFileUpload('file', { maxBytes: env.maxFileSizeBytes, label: 'CSV file' }),
  ...ctrl.importCsv,
);
router.get('/export', requirePermission('pilot:manage'), ...ctrl.exportCsv);
router.get('/:pilotId', ...ctrl.get);
router.patch('/:pilotId', requirePermission('pilot:manage'), ...ctrl.update);
router.put('/:pilotId', requirePermission('pilot:manage'), ...ctrl.update);
router.patch('/:pilotId/status', requirePermission('pilot:manage'), ...ctrl.updateStatus);
router.post('/:pilotId/accept', requirePermission('pilot:manage'), ...ctrl.accept);
router.post('/:pilotId/reject', requirePermission('pilot:manage'), ...ctrl.reject);
router.delete('/:pilotId', requirePermission('pilot:manage'), ...ctrl.remove);

export default router;

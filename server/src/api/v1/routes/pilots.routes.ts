import { Router } from 'express';
import { requireAuth, requirePermission } from '../../../auth/rbac.js';
import * as ctrl from '../controllers/pilots.controller.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get('/', ...ctrl.list);
router.get('/search', ...ctrl.search);
router.get('/qr/:code', ...ctrl.qrLookup);
router.post('/', requirePermission('pilot:manage'), ...ctrl.create);
router.post('/import', requirePermission('pilot:manage'), ctrl.upload.single('file'), ...ctrl.importCsv);
router.get('/:pilotId', ...ctrl.get);
router.patch('/:pilotId', requirePermission('pilot:manage'), ...ctrl.update);
router.put('/:pilotId', requirePermission('pilot:manage'), ...ctrl.update);
router.delete('/:pilotId', requirePermission('pilot:manage'), ...ctrl.remove);

export default router;

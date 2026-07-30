import { Router } from 'express';
import { requireAuth, requirePermission } from '../../../auth/rbac.js';
import * as ctrl from '../controllers/print.controller.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get('/', ...ctrl.list);
router.post('/generate', requirePermission('print:generate'), ...ctrl.generate);
router.get('/:printId/download', requirePermission('print:generate'), ...ctrl.download);
router.post('/:printId/approve', requirePermission('print:approve'), ...ctrl.approve);

export default router;

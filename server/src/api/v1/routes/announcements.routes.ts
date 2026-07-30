import { Router } from 'express';
import { requireAuth, requirePermission } from '../../../auth/rbac.js';
import * as ctrl from '../controllers/announcements.controller.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get('/', ...ctrl.list);
router.post('/', requirePermission('announce'), ...ctrl.create);
router.patch('/:id', requirePermission('announce'), ...ctrl.update);
router.delete('/:id', requirePermission('announce'), ...ctrl.remove);

export default router;

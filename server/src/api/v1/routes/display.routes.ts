import { Router } from 'express';
import { requireAuth, requirePermission } from '../../../auth/rbac.js';
import * as ctrl from '../controllers/display.controller.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get('/', ...ctrl.list);
router.get('/default', ...ctrl.getDefault);
router.post('/', requirePermission('display:control'), ...ctrl.create);
router.get('/:id', ...ctrl.get);
router.patch('/:id', requirePermission('display:control'), ...ctrl.update);
router.delete('/:id', requirePermission('display:control'), ...ctrl.remove);

export default router;

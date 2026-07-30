import { Router } from 'express';
import { requireAuth, requirePermission } from '../../../auth/rbac.js';
import * as ctrl from '../controllers/scores.controller.js';

const router = Router();

router.use(requireAuth);

router.post('/enter', requirePermission('score:enter'), ...ctrl.enter);
router.post('/:scoreId/confirm', requirePermission('score:confirm'), ...ctrl.confirm);
router.get('/:scoreId', ...ctrl.get);

export default router;

import { Router } from 'express';
import { requireAuth, requirePermission } from '../../../auth/rbac.js';
import * as ctrl from '../controllers/approvals.controller.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get('/', ...ctrl.list);
router.get('/status', ...ctrl.status);
router.post('/request', requirePermission('round:close'), ...ctrl.request);
router.post('/chief-judge', requirePermission('score:approve_chief'), ...ctrl.chiefJudgeDecide);
router.post('/director', requirePermission('score:approve_director'), ...ctrl.directorDecide);

export default router;

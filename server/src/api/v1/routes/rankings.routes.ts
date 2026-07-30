import { Router } from 'express';
import { requireAuth, requirePermission } from '../../../auth/rbac.js';
import * as ctrl from '../controllers/rankings.controller.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get('/overall', ...ctrl.overall);
router.get('/individual', ...ctrl.overall);
router.get('/women', ...ctrl.women);
router.get('/junior', ...ctrl.junior);
router.get('/team', ...ctrl.team);
router.get('/country', ...ctrl.country);
router.post('/recalculate', requirePermission('score:enter'), ...ctrl.recalculate);

export default router;

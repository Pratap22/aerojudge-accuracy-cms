import { Router } from 'express';
import { requireAuth } from '../../../auth/rbac.js';
import * as ctrl from '../controllers/statistics.controller.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get('/', ...ctrl.competition);
router.get('/rounds/:roundId', ...ctrl.round);

export default router;

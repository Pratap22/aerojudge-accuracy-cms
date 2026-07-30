import { Router } from 'express';
import { requireAuth, requirePermission } from '../../../auth/rbac.js';
import * as scoreCtrl from '../controllers/scores.controller.js';
import * as resultsCtrl from '../controllers/results.controller.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get('/rounds/:roundId/scores', ...scoreCtrl.listByRound);
router.post('/recalculate', requirePermission('results:publish'), ...resultsCtrl.recalculate);
router.get('/rankings/individual', ...resultsCtrl.individual);
router.get('/rankings/team', ...resultsCtrl.team);
router.get('/rankings/country', ...resultsCtrl.country);
router.get('/rankings/women', ...resultsCtrl.women);
router.post('/publish', requirePermission('results:publish'), ...resultsCtrl.publish);

export default router;

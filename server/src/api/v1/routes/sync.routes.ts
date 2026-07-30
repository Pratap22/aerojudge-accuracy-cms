import { Router } from 'express';
import { requireAuth } from '../../../auth/rbac.js';
import * as ctrl from '../controllers/sync.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/pending', ctrl.pending);
router.post('/enqueue', ...ctrl.enqueue);
router.post('/clients/:clientId/process', ...ctrl.processBatch);
router.post('/:id/synced', ...ctrl.markSynced);
router.post('/:id/failed', ...ctrl.markFailed);

export default router;

import { Router } from 'express';
import { requireAuth, requirePermission } from '../../../auth/rbac.js';
import { env } from '../../../config/env.js';
import { singleFileUpload } from '../../../utils/upload.js';
import * as ctrl from '../controllers/rounds.controller.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get('/', ...ctrl.list);
router.post('/', requirePermission('round:manage'), ...ctrl.create);
router.post(
  '/import-scores',
  requirePermission('score:enter'),
  singleFileUpload('file', { maxBytes: env.maxFileSizeBytes, label: 'CSV file' }),
  ...ctrl.importScores,
);
router.get('/:roundId', ...ctrl.get);
router.patch('/:roundId', requirePermission('round:manage'), ...ctrl.update);
router.delete('/:roundId', requirePermission('round:manage'), ...ctrl.remove);
router.post('/:roundId/start', requirePermission('round:start'), ...ctrl.start);
router.post('/:roundId/pause', requirePermission('round:manage'), ...ctrl.pause);
router.post('/:roundId/resume', requirePermission('round:start'), ...ctrl.resume);
router.post('/:roundId/close', requirePermission('round:close'), ...ctrl.close);
router.post('/:roundId/reopen', requirePermission('round:manage'), ...ctrl.reopen);
router.post('/:roundId/approve', requirePermission('score:approve_chief'), ...ctrl.approve);
router.post('/:roundId/lock', requirePermission('round:manage'), ...ctrl.lock);
router.post('/:roundId/flight-order', requirePermission('round:manage'), ...ctrl.generateFlightOrder);
router.get('/:roundId/flights', ...ctrl.listFlights);
router.post('/:roundId/scores', requirePermission('score:enter'), ...ctrl.enterScore);

export default router;

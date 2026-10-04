import { Router } from 'express';
import { requirePermission } from '../../../auth/rbac.js';
import { singleFileUpload } from '../../../utils/upload.js';
import * as ctrl from '../controllers/event-feed.controller.js';

const router = Router({ mergeParams: true });

router.get('/', requirePermission('feed:manage'), ...ctrl.listFeed);
router.post('/text', requirePermission('feed:manage'), ...ctrl.createText);
router.post('/score', requirePermission('feed:manage'), ...ctrl.createScore);
router.post(
  '/photo',
  requirePermission('feed:manage'),
  singleFileUpload('photo', { maxBytes: 8 * 1024 * 1024, label: 'Event photo' }),
  ...ctrl.createPhoto,
);
router.delete('/:itemId', requirePermission('feed:manage'), ...ctrl.deleteFeedItem);

export default router;

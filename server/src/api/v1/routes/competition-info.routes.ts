import { Router } from 'express';
import { requireAuth, requirePermission } from '../../../auth/rbac.js';
import { singleFileUpload } from '../../../utils/upload.js';
import * as ctrl from '../controllers/competition-info.controller.js';

const router = Router({ mergeParams: true });

const GALLERY_MAX_BYTES = 8 * 1024 * 1024;

router.use(requireAuth);

router.get('/', ...ctrl.get);
router.put('/', requirePermission('competition:update'), ...ctrl.update);
router.patch('/', requirePermission('competition:update'), ...ctrl.update);

router.post(
  '/gallery',
  requirePermission('competition:update'),
  singleFileUpload('image', { maxBytes: GALLERY_MAX_BYTES, label: 'Gallery image' }),
  ...ctrl.uploadGalleryImage,
);
router.patch(
  '/gallery/:imageId',
  requirePermission('competition:update'),
  ...ctrl.updateGalleryImage,
);
router.delete(
  '/gallery/:imageId',
  requirePermission('competition:update'),
  ...ctrl.removeGalleryImage,
);

router.post('/links', requirePermission('competition:update'), ...ctrl.createLink);
router.patch('/links/:linkId', requirePermission('competition:update'), ...ctrl.updateLink);
router.delete('/links/:linkId', requirePermission('competition:update'), ...ctrl.removeLink);

router.post('/contacts', requirePermission('competition:update'), ...ctrl.createContact);
router.patch(
  '/contacts/:contactId',
  requirePermission('competition:update'),
  ...ctrl.updateContact,
);
router.delete(
  '/contacts/:contactId',
  requirePermission('competition:update'),
  ...ctrl.removeContact,
);

export default router;

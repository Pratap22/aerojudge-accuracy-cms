import { Router } from 'express';
import { requireAuth, requirePermission, resolveOrganizationContext } from '../../../auth/rbac.js';
import * as ctrl from '../controllers/people.controller.js';

const router = Router();

/** Authenticated directory (organizers). Org context required for permission bundles. */
router.use(requireAuth, resolveOrganizationContext);

router.get('/', requirePermission('pilot:manage'), ...ctrl.search);
router.post('/match', requirePermission('pilot:manage'), ...ctrl.match);
router.post('/', requirePermission('pilot:manage'), ...ctrl.create);

router.get('/claims', requirePermission('pilot:manage'), ...ctrl.listPendingClaims);
router.post('/claims/:claimId/approve', requirePermission('pilot:manage'), ...ctrl.approveClaim);
router.post('/claims/:claimId/reject', requirePermission('pilot:manage'), ...ctrl.rejectClaim);

router.get('/:personId', requirePermission('pilot:manage'), ...ctrl.get);
router.patch('/:personId', requirePermission('pilot:manage'), ...ctrl.update);
router.get('/:personId/history', requirePermission('pilot:manage'), ...ctrl.history);
router.post('/:personId/merge', requirePermission('organization:manage'), ...ctrl.merge);
router.post('/:personId/claim', ...ctrl.requestClaim);
router.post('/:personId/link-user', requirePermission('pilot:manage'), ...ctrl.linkUser);
router.delete('/:personId/link-user', requirePermission('pilot:manage'), ...ctrl.unlinkUser);

export default router;

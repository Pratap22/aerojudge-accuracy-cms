import { Router } from 'express';
import { requireAuth, requirePermission } from '../../../auth/rbac.js';
import * as ctrl from '../controllers/teams.controller.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get('/', ...ctrl.list);
router.post('/', requirePermission('team:manage'), ...ctrl.create);
router.get('/:teamId', ...ctrl.get);
router.patch('/:teamId', requirePermission('team:manage'), ...ctrl.update);
router.delete('/:teamId', requirePermission('team:manage'), ...ctrl.remove);
router.put('/:teamId/members', requirePermission('team:manage'), ...ctrl.setMembers);
router.post('/:teamId/validate', requirePermission('team:manage'), ...ctrl.validate);

export default router;

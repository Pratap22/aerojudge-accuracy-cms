import { Router } from 'express';
import { requireAuth, requirePermission, requireRoles } from '../../../auth/rbac.js';
import * as ctrl from '../controllers/users.controller.js';

const router = Router();

router.use(requireAuth, requireRoles('SUPER_ADMIN'), requirePermission('user:manage'));

router.get('/', ...ctrl.list);
router.post('/', ...ctrl.create);
router.get('/:id', ...ctrl.get);
router.patch('/:id', ...ctrl.update);
router.delete('/:id', ...ctrl.remove);

export default router;

import { Router } from 'express';
import { requireAuth, resolveOrganizationContext } from '../../../auth/rbac.js';
import * as ctrl from '../controllers/auth.controller.js';

const router = Router();

router.post('/login', ...ctrl.login);
router.post('/refresh', ...ctrl.refresh);
router.post('/logout', ...ctrl.logout);
router.post('/select-organization', requireAuth, ...ctrl.selectOrganization);
router.get('/me', requireAuth, resolveOrganizationContext, ctrl.me);

export default router;

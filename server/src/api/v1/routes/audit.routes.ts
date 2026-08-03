import { Router } from 'express';
import { requirePermission } from '../../../auth/rbac.js';
import * as ctrl from '../controllers/audit.controller.js';

const router = Router({ mergeParams: true });

/** Competition-scoped audit trail. Auth + org + competition ownership via parent guards. */
router.get('/', requirePermission('audit:view'), ...ctrl.list);

export default router;

import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { hasEffectivePermission, type Permission } from '@aero-judge/shared';
import { requireAuth } from '../../../auth/rbac.js';
import { AppError } from '../../../utils/errors.js';
import { singleFileUpload } from '../../../utils/upload.js';
import * as ctrl from '../controllers/protests.controller.js';

const router = Router({ mergeParams: true });

const FORM_MAX_BYTES = 10 * 1024 * 1024;

/** Meet director can log protests; chief judge can as well. Statistics viewers can read the log. */
const WRITE_PERMISSIONS: Permission[] = ['competition:update', 'score:approve_chief'];
const READ_PERMISSIONS: Permission[] = [
  ...WRITE_PERMISSIONS,
  'audit:view',
  'results:publish',
  'score:confirm',
  'print:generate',
];

function requireAnyOf(permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized());
      return;
    }
    const orgResolved = Boolean(req.organizationId || req.orgRole || req.permissions);
    const allowed = permissions.some((permission) =>
      hasEffectivePermission({
        platformRole: req.user!.role,
        orgRole: req.orgRole ?? req.user!.orgRole,
        permissions: req.permissions ?? req.user!.permissions,
        permission,
        allowLegacyGlobalRole: !orgResolved,
      }),
    );
    if (!allowed) {
      next(AppError.forbidden('Missing permission to view protests'));
      return;
    }
    next();
  };
}

router.use(requireAuth);
router.get('/', requireAnyOf(READ_PERMISSIONS), ...ctrl.list);
router.post('/', requireAnyOf(WRITE_PERMISSIONS), ...ctrl.create);
router.patch('/:protestId', requireAnyOf(WRITE_PERMISSIONS), ...ctrl.update);
router.delete('/:protestId', requireAnyOf(WRITE_PERMISSIONS), ...ctrl.remove);
router.post(
  '/:protestId/form',
  requireAnyOf(WRITE_PERMISSIONS),
  singleFileUpload('form', { maxBytes: FORM_MAX_BYTES, label: 'Signed protest form' }),
  ...ctrl.uploadForm,
);

export default router;

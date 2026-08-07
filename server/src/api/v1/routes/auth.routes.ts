import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth, resolveOrganizationContext } from '../../../auth/rbac.js';
import * as ctrl from '../controllers/auth.controller.js';

const router = Router();

/** Stricter limit for password-reset endpoints (always on). */
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { message: 'Too many requests. Try again later.', code: 'RATE_LIMIT' },
  },
});

router.post('/login', ...ctrl.login);
router.post('/register', ...ctrl.registerParticipant);
router.post('/refresh', ...ctrl.refresh);
router.post('/logout', ...ctrl.logout);
router.post('/forgot-password', passwordResetLimiter, ...ctrl.forgotPassword);
router.post('/reset-password', passwordResetLimiter, ...ctrl.resetPassword);
router.post('/select-organization', requireAuth, ...ctrl.selectOrganization);
router.get('/me', requireAuth, resolveOrganizationContext, ctrl.me);
router.get('/me/person/lookup', requireAuth, ...ctrl.claimLookup);
router.post('/me/person/claim', requireAuth, ...ctrl.claimPerson);

export default router;

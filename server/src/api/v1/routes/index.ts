import { Router } from 'express';
import authRoutes from './auth.routes.js';
import competitionsRoutes from './competitions.routes.js';
import pilotsRoutes from './pilots.routes.js';
import teamsRoutes from './teams.routes.js';
import roundsRoutes from './rounds.routes.js';
import scoresRoutes from './scores.routes.js';
import resultsRoutes from './results.routes.js';
import rankingsRoutes from './rankings.routes.js';
import approvalsRoutes from './approvals.routes.js';
import printRoutes from './print.routes.js';
import usersRoutes from './users.routes.js';
import announcementsRoutes from './announcements.routes.js';
import weatherRoutes from './weather.routes.js';
import displayRoutes from './display.routes.js';
import sponsorsRoutes from './sponsors.routes.js';
import officialsRoutes from './officials.routes.js';
import statisticsRoutes from './statistics.routes.js';
import syncRoutes from './sync.routes.js';
import peopleRoutes from './people.routes.js';
import publicRoutes from './public.routes.js';
import auditRoutes from './audit.routes.js';
import { organizationRoutes } from '../../../modules/organization/index.js';
import { competitionScopedGuards } from '../middleware/org-scope.js';
import {
  requireAuth,
  resolveOrganizationContext,
  requireOrgContext,
} from '../../../auth/rbac.js';
import { prisma } from '../../../config/prisma.js';
import { AppError, asyncHandler } from '../../../utils/errors.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/organizations', organizationRoutes);
router.use('/people', peopleRoutes);
router.use('/sync', syncRoutes);
router.use('/public', publicRoutes);

router.use('/competitions', competitionsRoutes);

const nested = Router({ mergeParams: true });
nested.use(...competitionScopedGuards);
nested.use('/pilots', pilotsRoutes);
nested.use('/teams', teamsRoutes);
nested.use('/rounds', roundsRoutes);
nested.use('/rounds/:roundId/approvals', approvalsRoutes);
nested.use('/results', resultsRoutes);
nested.use('/rankings', rankingsRoutes);
nested.use('/reports', printRoutes);
nested.use('/announcements', announcementsRoutes);
nested.use('/weather', weatherRoutes);
nested.use('/display-layouts', displayRoutes);
nested.use('/sponsors', sponsorsRoutes);
nested.use('/officials', officialsRoutes);
nested.use('/statistics', statisticsRoutes);
nested.use('/audit', auditRoutes);

router.use('/competitions/:competitionId', nested);

/**
 * Scores are competition-scoped via flight → round → competition.
 * Require active org membership; never allow tenant mutations without org context
 * (legacy User.role fallback must not bypass isolation).
 */
router.use(
  '/scores',
  requireAuth,
  resolveOrganizationContext,
  requireOrgContext,
  asyncHandler(async (req, _res, next) => {
    if (req.body?.flightId) {
      const flight = await prisma.flight.findUnique({
        where: { id: req.body.flightId },
        select: {
          round: { select: { competition: { select: { organizationId: true } } } },
        },
      });
      if (!flight || flight.round.competition.organizationId !== req.organizationId) {
        // Default deny without leaking whether the flight exists in another org.
        next(AppError.notFound('Flight not found'));
        return;
      }
    }
    next();
  }),
  scoresRoutes,
);

router.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', version: 'v1' } });
});

export default router;

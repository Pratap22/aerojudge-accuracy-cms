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
import statisticsRoutes from './statistics.routes.js';
import syncRoutes from './sync.routes.js';
import publicRoutes from './public.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/sync', syncRoutes);
router.use('/public', publicRoutes);

router.use('/competitions', competitionsRoutes);
router.use('/competitions/:competitionId/pilots', pilotsRoutes);
router.use('/competitions/:competitionId/teams', teamsRoutes);
router.use('/competitions/:competitionId/rounds', roundsRoutes);
router.use('/competitions/:competitionId/rounds/:roundId/approvals', approvalsRoutes);
router.use('/competitions/:competitionId/results', resultsRoutes);
router.use('/competitions/:competitionId/rankings', rankingsRoutes);
router.use('/competitions/:competitionId/reports', printRoutes);
router.use('/competitions/:competitionId/announcements', announcementsRoutes);
router.use('/competitions/:competitionId/weather', weatherRoutes);
router.use('/competitions/:competitionId/display-layouts', displayRoutes);
router.use('/competitions/:competitionId/statistics', statisticsRoutes);

router.use('/scores', scoresRoutes);

router.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', version: 'v1' } });
});

export default router;

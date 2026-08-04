import { Router } from 'express';
import { requireAuth } from '../../../auth/rbac.js';
import { singleFileUpload } from '../../../utils/upload.js';
import * as ctrl from '../controllers/public.controller.js';

const router = Router();

// SEO crawler / social preview endpoints (must stay before /:slug)
router.get('/seo/render', ...ctrl.renderSeoHtml);
router.get('/seo/meta', ...ctrl.seoMetaJson);
router.get('/sitemap.xml', ...ctrl.sitemapXml);
router.get('/robots.txt', ...ctrl.robotsTxt);

router.get('/competitions', ...ctrl.listCompetitions);
router.get('/countries', ...ctrl.listCountries);
router.get('/profiles/:aeroJudgeId', ...ctrl.publicProfile);
router.get('/:slug', ...ctrl.getCompetition);
router.get('/:slug/results', ...ctrl.getResults);
router.get('/:slug/rounds', ...ctrl.getRoundResults);
router.get('/:slug/rounds-status', ...ctrl.getRoundsStatus);
router.get('/:slug/latest-score', ...ctrl.getLatestScore);
router.get('/:slug/sponsors', ...ctrl.getSponsors);
router.get('/:slug/officials', ...ctrl.getOfficials);
router.get('/:slug/pilots', ...ctrl.listPilots);
/** Self-reg: login → claim/profile → competition enrollment */
router.post('/:slug/register', requireAuth, ...ctrl.registerPilot);
router.post(
  '/:slug/pilots/:pilotId/photo',
  requireAuth,
  singleFileUpload('photo', { maxBytes: 2 * 1024 * 1024, label: 'Pilot photo' }),
  ...ctrl.uploadPilotPhoto,
);

export default router;

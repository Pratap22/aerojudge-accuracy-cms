import { Router } from 'express';
import * as ctrl from '../controllers/public.controller.js';

const router = Router();

// SEO crawler / social preview endpoints (must stay before /:slug)
router.get('/seo/render', ...ctrl.renderSeoHtml);
router.get('/seo/meta', ...ctrl.seoMetaJson);
router.get('/sitemap.xml', ...ctrl.sitemapXml);
router.get('/robots.txt', ...ctrl.robotsTxt);

router.get('/competitions', ...ctrl.listCompetitions);
router.get('/countries', ...ctrl.listCountries);
router.get('/:slug', ...ctrl.getCompetition);
router.get('/:slug/results', ...ctrl.getResults);
router.get('/:slug/rounds', ...ctrl.getRoundResults);
router.get('/:slug/rounds-status', ...ctrl.getRoundsStatus);
router.get('/:slug/latest-score', ...ctrl.getLatestScore);
router.get('/:slug/sponsors', ...ctrl.getSponsors);
router.get('/:slug/officials', ...ctrl.getOfficials);
router.get('/:slug/pilots', ...ctrl.listPilots);
router.post('/:slug/register', ...ctrl.registerPilot);

export default router;

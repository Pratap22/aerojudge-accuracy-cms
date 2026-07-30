import { Router } from 'express';
import { requireAuth, requirePermission } from '../../../auth/rbac.js';
import * as ctrl from '../controllers/weather.controller.js';

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get('/weather', ...ctrl.listWeather);
router.post('/weather', requirePermission('weather:update'), ...ctrl.recordWeather);
router.get('/wind', ...ctrl.listWind);
router.get('/wind/latest', ...ctrl.latestWind);
router.post('/wind', requirePermission('weather:update'), ...ctrl.recordWind);

export default router;

import { Router } from 'express';
import * as ctrl from '../controllers/public.controller.js';

const router = Router();

router.get('/:slug', ...ctrl.getCompetition);
router.get('/:slug/results', ...ctrl.getResults);
router.get('/:slug/rounds', ...ctrl.getRoundResults);

export default router;

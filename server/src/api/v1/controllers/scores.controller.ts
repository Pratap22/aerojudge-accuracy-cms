import type { Request, Response } from 'express';
import { enterScoreSchema } from '@npha/shared';
import { z } from 'zod';
import { asyncHandler } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import * as scoreService from '../../../services/score.service.js';
import * as scoringService from '../../../services/scoring.service.js';
import { emitRankingUpdated, emitScoreUpdated, emitCurrentPilot } from '../../../socket/index.js';
import { auditFromRequest, writeAuditLog } from '../middleware/audit.js';
import { validateBody, validateParams } from '../middleware/validate.js';

const competitionRoundParams = z.object({
  competitionId: z.string().min(1),
  roundId: z.string().min(1),
});
const scoreParams = z.object({ scoreId: z.string().min(1) });
const enterBody = enterScoreSchema;

export const enter = [
  validateBody(enterBody),
  asyncHandler(async (req: Request, res: Response) => {
    const { score, computed, competitionId, roundId } = await scoreService.enterScore(
      req.body.flightId,
      {
        distanceCm: req.body.distanceCm,
        resultType: req.body.resultType,
        penaltyCm: req.body.penaltyCm,
        judgeNotes: req.body.judgeNotes,
        enteredById: req.user!.id,
      },
    );

    await writeAuditLog({
      ...auditFromRequest(req),
      competitionId,
      action: 'SCORE_ENTER',
      entityType: 'Score',
      entityId: score.id,
      after: score,
    });

    emitScoreUpdated(competitionId, roundId, computed, {
      id: score.pilot.id,
      pilotNumber: score.pilot.pilotNumber,
      firstName: score.pilot.firstName,
      lastName: score.pilot.lastName,
    });
    emitCurrentPilot(competitionId, score.pilotId, score.flightId);

    const recalc = await scoringService.recalculateRankings(competitionId);
    for (const category of recalc.categories) {
      emitRankingUpdated(competitionId, category);
    }
    emitRankingUpdated(competitionId, 'TEAM');

    sendSuccess(res, { score, computed, rankings: recalc }, 201);
  }),
];

export const confirm = [
  validateParams(scoreParams),
  asyncHandler(async (req: Request, res: Response) => {
    const score = await scoreService.confirmScore(req.params.scoreId, req.user!.id);
    sendSuccess(res, score);
  }),
];

export const listByRound = [
  validateParams(competitionRoundParams),
  asyncHandler(async (req: Request, res: Response) => {
    const scores = await scoreService.listScoresByRound(
      req.params.competitionId,
      req.params.roundId,
    );
    sendSuccess(res, scores);
  }),
];

export const get = [
  validateParams(scoreParams),
  asyncHandler(async (req: Request, res: Response) => {
    const score = await scoreService.getScore(req.params.scoreId);
    sendSuccess(res, score);
  }),
];

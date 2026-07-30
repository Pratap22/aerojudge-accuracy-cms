import type { Request, Response } from 'express';
import { createRoundSchema, enterScoreSchema } from '@npha/shared';
import { z } from 'zod';
import { asyncHandler } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import * as roundService from '../../../services/round.service.js';
import * as scoreService from '../../../services/score.service.js';
import * as scoringService from '../../../services/scoring.service.js';
import {
  emitRankingUpdated,
  emitRoundStatus,
  emitScoreUpdated,
} from '../../../socket/index.js';
import { validateBody, validateParams } from '../middleware/validate.js';

const competitionParams = z.object({ competitionId: z.string().min(1) });
const roundParams = z.object({ competitionId: z.string().min(1), roundId: z.string().min(1) });
const flightOrderBody = z.object({
  orderType: z.enum(['RANDOM', 'SEEDED', 'MANUAL', 'REVERSE']).optional(),
  seed: z.number().int().optional(),
  pilotIds: z.array(z.string()).optional(),
});

export const list = [
  validateParams(competitionParams),
  asyncHandler(async (req: Request, res: Response) => {
    const rounds = await roundService.listRounds(req.params.competitionId);
    sendSuccess(res, rounds);
  }),
];

export const get = [
  validateParams(roundParams),
  asyncHandler(async (req: Request, res: Response) => {
    const round = await roundService.getRound(req.params.competitionId, req.params.roundId);
    sendSuccess(res, round);
  }),
];

export const create = [
  validateParams(competitionParams),
  validateBody(createRoundSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const round = await roundService.createRound(req.params.competitionId, {
      ...req.body,
      scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : undefined,
    });
    sendSuccess(res, round, 201);
  }),
];

export const update = [
  validateParams(roundParams),
  asyncHandler(async (req: Request, res: Response) => {
    const round = await roundService.updateRound(
      req.params.competitionId,
      req.params.roundId,
      req.body,
    );
    sendSuccess(res, round);
  }),
];

export const remove = [
  validateParams(roundParams),
  asyncHandler(async (req: Request, res: Response) => {
    await roundService.deleteRound(req.params.competitionId, req.params.roundId);
    sendSuccess(res, { deleted: true });
  }),
];

export const start = [
  validateParams(roundParams),
  asyncHandler(async (req: Request, res: Response) => {
    const round = await roundService.startRound(req.params.competitionId, req.params.roundId);
    emitRoundStatus(req.params.competitionId, req.params.roundId, round.status);
    sendSuccess(res, round);
  }),
];

export const pause = [
  validateParams(roundParams),
  asyncHandler(async (req: Request, res: Response) => {
    const round = await roundService.pauseRound(req.params.competitionId, req.params.roundId);
    emitRoundStatus(req.params.competitionId, req.params.roundId, round.status);
    sendSuccess(res, round);
  }),
];

export const resume = [
  validateParams(roundParams),
  asyncHandler(async (req: Request, res: Response) => {
    const round = await roundService.resumeRound(req.params.competitionId, req.params.roundId);
    emitRoundStatus(req.params.competitionId, req.params.roundId, round.status);
    sendSuccess(res, round);
  }),
];

export const close = [
  validateParams(roundParams),
  asyncHandler(async (req: Request, res: Response) => {
    const round = await roundService.closeRound(req.params.competitionId, req.params.roundId);
    emitRoundStatus(req.params.competitionId, req.params.roundId, round.status);
    sendSuccess(res, round);
  }),
];

export const reopen = [
  validateParams(roundParams),
  asyncHandler(async (req: Request, res: Response) => {
    const round = await roundService.reopenRound(req.params.competitionId, req.params.roundId);
    emitRoundStatus(req.params.competitionId, req.params.roundId, round.status);
    sendSuccess(res, round);
  }),
];

export const generateFlightOrder = [
  validateParams(roundParams),
  validateBody(flightOrderBody),
  asyncHandler(async (req: Request, res: Response) => {
    const round = await roundService.getRound(req.params.competitionId, req.params.roundId);
    const orderType = req.body.orderType ?? round.orderType;
    const result = await roundService.generateFlightOrder(
      req.params.competitionId,
      req.params.roundId,
      orderType,
      { seed: req.body.seed, manualOrder: req.body.pilotIds },
    );
    sendSuccess(res, result);
  }),
];

export const listFlights = [
  validateParams(roundParams),
  asyncHandler(async (req: Request, res: Response) => {
    const flights = await roundService.listFlights(
      req.params.competitionId,
      req.params.roundId,
    );
    sendSuccess(res, flights);
  }),
];

export const enterScore = [
  validateParams(roundParams),
  validateBody(enterScoreSchema),
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

    emitScoreUpdated(competitionId, roundId, computed);

    const recalc = await scoringService.recalculateRankings(competitionId);
    for (const category of recalc.categories) {
      emitRankingUpdated(competitionId, category);
    }
    emitRankingUpdated(competitionId, 'TEAM');

    sendSuccess(res, { score, computed, rankings: recalc }, 201);
  }),
];

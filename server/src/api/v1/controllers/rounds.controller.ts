import type { Request, Response } from 'express';
import {
  createRoundSchema,
  enterScoreSchema,
  updateRoundTypeSchema,
  SYSTEM_ORG_ROLE_DEFINITIONS,
  mapLegacyRoleToOrgRole,
  type OrgRole,
} from '@npha/shared';
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
  emitCurrentPilot,
} from '../../../socket/index.js';
import { validateBody, validateParams } from '../middleware/validate.js';

function approverRoleLabel(req: Request): string {
  const orgRole =
    req.user?.orgRole ?? (req.user?.role ? mapLegacyRoleToOrgRole(req.user.role) : null);
  return (
    (orgRole && SYSTEM_ORG_ROLE_DEFINITIONS[orgRole as OrgRole]?.name) ||
    'Meet Director'
  );
}

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
  validateBody(updateRoundTypeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const round = await roundService.updateRound(
      req.params.competitionId,
      req.params.roundId,
      req.body,
    );
    // Type change can move a round in/out of ranking eligibility
    if (round.status === 'APPROVED' || round.status === 'LOCKED') {
      await scoringService.recalculateRankings(req.params.competitionId);
    }
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
    emitRoundStatus(req.params.competitionId, req.params.roundId, round.status, round.number);
    sendSuccess(res, round);
  }),
];

export const pause = [
  validateParams(roundParams),
  asyncHandler(async (req: Request, res: Response) => {
    const round = await roundService.pauseRound(req.params.competitionId, req.params.roundId);
    emitRoundStatus(req.params.competitionId, req.params.roundId, round.status, round.number);
    sendSuccess(res, round);
  }),
];

export const resume = [
  validateParams(roundParams),
  asyncHandler(async (req: Request, res: Response) => {
    const round = await roundService.resumeRound(req.params.competitionId, req.params.roundId);
    emitRoundStatus(req.params.competitionId, req.params.roundId, round.status, round.number);
    sendSuccess(res, round);
  }),
];

export const close = [
  validateParams(roundParams),
  asyncHandler(async (req: Request, res: Response) => {
    await scoreService.assignMissingScoresAsDnf(
      req.params.competitionId,
      req.params.roundId,
      req.user?.id,
    );
    const round = await roundService.closeRound(req.params.competitionId, req.params.roundId);
    emitRoundStatus(req.params.competitionId, req.params.roundId, round.status, round.number);
    const recalc = await scoringService.recalculateRankings(req.params.competitionId);
    for (const category of recalc.categories) {
      emitRankingUpdated(req.params.competitionId, category);
    }
    sendSuccess(res, round);
  }),
];

export const reopen = [
  validateParams(roundParams),
  asyncHandler(async (req: Request, res: Response) => {
    const round = await roundService.reopenRound(req.params.competitionId, req.params.roundId);
    emitRoundStatus(req.params.competitionId, req.params.roundId, round.status, round.number);
    sendSuccess(res, round);
  }),
];

export const approve = [
  validateParams(roundParams),
  asyncHandler(async (req: Request, res: Response) => {
    await scoreService.assignMissingScoresAsDnf(
      req.params.competitionId,
      req.params.roundId,
      req.user?.id,
    );
    const round = await roundService.approveRound(
      req.params.competitionId,
      req.params.roundId,
      req.user?.id
        ? { userId: req.user.id, roleLabel: approverRoleLabel(req) }
        : undefined,
    );
    emitRoundStatus(req.params.competitionId, req.params.roundId, round.status, round.number);
    const recalc = await scoringService.recalculateRankings(req.params.competitionId);
    for (const category of recalc.categories) {
      emitRankingUpdated(req.params.competitionId, category);
    }
    emitRankingUpdated(req.params.competitionId, 'TEAM');
    sendSuccess(res, round);
  }),
];

export const lock = [
  validateParams(roundParams),
  asyncHandler(async (req: Request, res: Response) => {
    // Final DNF fill before lock — after this, scores are immutable
    await scoreService.assignMissingScoresAsDnf(
      req.params.competitionId,
      req.params.roundId,
      req.user?.id,
    );
    const round = await roundService.lockRound(req.params.competitionId, req.params.roundId);
    emitRoundStatus(req.params.competitionId, req.params.roundId, round.status, round.number);
    const recalc = await scoringService.recalculateRankings(req.params.competitionId);
    for (const category of recalc.categories) {
      emitRankingUpdated(req.params.competitionId, category);
    }
    emitRankingUpdated(req.params.competitionId, 'TEAM');
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
    const { score, computed, competitionId, roundId, roundNumber } = await scoreService.enterScore(
      req.body.flightId,
      {
        distanceCm: req.body.distanceCm,
        resultType: req.body.resultType,
        penaltyCm: req.body.penaltyCm,
        judgeNotes: req.body.judgeNotes,
        enteredById: req.user!.id,
      },
    );

    emitScoreUpdated(
      competitionId,
      roundId,
      computed,
      {
        id: score.pilot.id,
        pilotNumber: score.pilot.pilotNumber,
        firstName: score.pilot.firstName,
        lastName: score.pilot.lastName,
      },
      roundNumber,
    );
    emitCurrentPilot(competitionId, score.pilotId, score.flightId);

    const recalc = await scoringService.recalculateRankings(competitionId);
    for (const category of recalc.categories) {
      emitRankingUpdated(competitionId, category);
    }
    emitRankingUpdated(competitionId, 'TEAM');

    sendSuccess(res, { score, computed, rankings: recalc }, 201);
  }),
];

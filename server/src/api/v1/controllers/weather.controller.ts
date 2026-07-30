import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import * as weatherService from '../../../services/weather.service.js';
import { emitWindUpdated } from '../../../socket/index.js';
import { validateBody, validateParams } from '../middleware/validate.js';

const competitionParams = z.object({ competitionId: z.string().min(1) });

const weatherBody = z.object({
  temperatureC: z.number().optional(),
  humidityPct: z.number().min(0).max(100).optional(),
  pressureHpa: z.number().optional(),
  conditions: z.string().optional(),
  source: z.string().optional(),
});

const windBody = z.object({
  directionDeg: z.number().min(0).max(360),
  speedMs: z.number().min(0),
  gustMs: z.number().min(0).optional(),
  source: z.string().optional(),
});

export const listWeather = [
  validateParams(competitionParams),
  asyncHandler(async (req: Request, res: Response) => {
    const items = await weatherService.listWeather(req.params.competitionId);
    sendSuccess(res, items);
  }),
];

export const recordWeather = [
  validateParams(competitionParams),
  validateBody(weatherBody),
  asyncHandler(async (req: Request, res: Response) => {
    const reading = await weatherService.recordWeather(req.params.competitionId, req.body);
    sendSuccess(res, reading, 201);
  }),
];

export const listWind = [
  validateParams(competitionParams),
  asyncHandler(async (req: Request, res: Response) => {
    const items = await weatherService.listWind(req.params.competitionId);
    sendSuccess(res, items);
  }),
];

export const recordWind = [
  validateParams(competitionParams),
  validateBody(windBody),
  asyncHandler(async (req: Request, res: Response) => {
    const reading = await weatherService.recordWind(req.params.competitionId, req.body);
    emitWindUpdated(req.params.competitionId, {
      directionDeg: reading.directionDeg,
      speedMs: reading.speedMs,
    });
    sendSuccess(res, reading, 201);
  }),
];

export const latestWind = [
  validateParams(competitionParams),
  asyncHandler(async (req: Request, res: Response) => {
    const reading = await weatherService.getLatestWind(req.params.competitionId);
    sendSuccess(res, reading);
  }),
];

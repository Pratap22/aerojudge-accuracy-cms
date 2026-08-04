import type { Request, Response } from 'express';
import {
  authenticatedPilotRegistrationSchema,
  publicPilotRegistrationSchema,
} from '@npha/shared';
import { z } from 'zod';
import { asyncHandler, AppError } from '../../../utils/errors.js';
import { sendSuccess } from '../../../utils/response.js';
import * as publicService from '../../../services/public.service.js';
import * as seoService from '../../../services/seo.service.js';
import * as personService from '../../../services/person.service.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.js';

const slugParams = z.object({ slug: z.string().min(1) });
const aeroJudgeParams = z.object({ aeroJudgeId: z.string().min(1) });
const roundQuery = z.object({ round: z.coerce.number().int().positive() });
const categoryQuery = z.object({
  category: z.enum(['OVERALL', 'WOMEN', 'JUNIOR', 'TEAM', 'COUNTRY']).default('OVERALL'),
});

export const listCompetitions = [
  asyncHandler(async (_req: Request, res: Response) => {
    const competitions = await publicService.listPublicCompetitions();
    sendSuccess(res, competitions);
  }),
];

/** Crawler / social-preview HTML. Path from X-Original-URI or ?path= */
export const renderSeoHtml = [
  asyncHandler(async (req: Request, res: Response) => {
    const fromHeader = String(req.headers['x-original-uri'] ?? '');
    const fromQuery = typeof req.query.path === 'string' ? req.query.path : '';
    const rawPath = fromHeader || fromQuery || '/events/';
    const meta = await seoService.resolveSeoMeta(rawPath);
    const html = seoService.renderSeoHtml(meta);
    res
      .status(meta.robots?.includes('noindex') ? 404 : 200)
      .setHeader('Content-Type', 'text/html; charset=utf-8')
      .setHeader('Cache-Control', 'public, max-age=120, s-maxage=300')
      .send(html);
  }),
];

export const seoMetaJson = [
  asyncHandler(async (req: Request, res: Response) => {
    const path = typeof req.query.path === 'string' ? req.query.path : '/events/';
    const meta = await seoService.resolveSeoMeta(path);
    sendSuccess(res, meta);
  }),
];

export const sitemapXml = [
  asyncHandler(async (_req: Request, res: Response) => {
    const xml = await seoService.buildSitemapXml();
    res
      .status(200)
      .setHeader('Content-Type', 'application/xml; charset=utf-8')
      .setHeader('Cache-Control', 'public, max-age=600')
      .send(xml);
  }),
];

export const robotsTxt = [
  asyncHandler(async (_req: Request, res: Response) => {
    res
      .status(200)
      .setHeader('Content-Type', 'text/plain; charset=utf-8')
      .setHeader('Cache-Control', 'public, max-age=3600')
      .send(seoService.robotsTxt());
  }),
];

export const getCompetition = [
  validateParams(slugParams),
  asyncHandler(async (req: Request, res: Response) => {
    const competition = await publicService.getPublicCompetition(req.params.slug);
    sendSuccess(res, competition);
  }),
];

export const getResults = [
  validateParams(slugParams),
  validateQuery(categoryQuery),
  asyncHandler(async (req: Request, res: Response) => {
    const results = await publicService.getPublicResults(
      req.params.slug,
      req.query.category as string,
    );
    sendSuccess(res, results);
  }),
];

export const getRoundResults = [
  validateParams(slugParams),
  validateQuery(roundQuery),
  asyncHandler(async (req: Request, res: Response) => {
    const { round } = roundQuery.parse(req.query as unknown);
    const results = await publicService.getPublicRoundResults(req.params.slug, round);
    sendSuccess(res, results);
  }),
];

export const getRoundsStatus = [
  validateParams(slugParams),
  asyncHandler(async (req: Request, res: Response) => {
    const status = await publicService.getPublicRoundsStatus(req.params.slug);
    sendSuccess(res, status);
  }),
];

export const getLatestScore = [
  validateParams(slugParams),
  asyncHandler(async (req: Request, res: Response) => {
    const latest = await publicService.getLatestPublicScore(req.params.slug);
    sendSuccess(res, latest);
  }),
];

export const getSponsors = [
  validateParams(slugParams),
  asyncHandler(async (req: Request, res: Response) => {
    const sponsors = await publicService.getPublicSponsors(req.params.slug);
    sendSuccess(res, sponsors);
  }),
];

export const getOfficials = [
  validateParams(slugParams),
  asyncHandler(async (req: Request, res: Response) => {
    const officials = await publicService.getPublicOfficials(req.params.slug);
    sendSuccess(res, officials);
  }),
];

export const listCountries = [
  asyncHandler(async (_req: Request, res: Response) => {
    const countries = await publicService.listPublicCountries();
    sendSuccess(res, countries);
  }),
];

export const publicProfile = [
  validateParams(aeroJudgeParams),
  asyncHandler(async (req: Request, res: Response) => {
    const profile = await personService.getPublicProfile(req.params.aeroJudgeId);
    sendSuccess(res, profile);
  }),
];

export const listPilots = [
  validateParams(slugParams),
  asyncHandler(async (req: Request, res: Response) => {
    const pilots = await publicService.listPublicPilots(req.params.slug);
    sendSuccess(res, pilots);
  }),
];

export const registerPilot = [
  validateParams(slugParams),
  validateBody(authenticatedPilotRegistrationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw AppError.unauthorized(
        'Sign in with your AeroJudge account to register for this competition',
      );
    }
    const pilot = await publicService.registerAuthenticatedPilot(
      req.params.slug,
      req.user.id,
      req.body,
    );
    sendSuccess(res, pilot, 201);
  }),
];

const pilotPhotoParams = z.object({ slug: z.string().min(1), pilotId: z.string().min(1) });

export const uploadPilotPhoto = [
  validateParams(pilotPhotoParams),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user?.id) {
      throw AppError.unauthorized('Sign in to upload a pilot photo');
    }
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: { message: 'Photo file required', code: 'BAD_REQUEST' },
      });
      return;
    }
    const pilot = await publicService.uploadOwnPilotPhoto(
      req.params.slug,
      req.user.id,
      req.params.pilotId,
      req.file,
    );
    sendSuccess(res, pilot);
  }),
];

/** @deprecated Unauthenticated open registration — disabled; use authenticated path. */
export const registerPilotLegacy = [
  validateParams(slugParams),
  validateBody(publicPilotRegistrationSchema),
  asyncHandler(async (_req: Request, _res: Response) => {
    throw AppError.unauthorized(
      'Pilot registration requires an AeroJudge account. Sign in or create an account first.',
    );
  }),
];

import { existsSync } from 'node:fs';
import path from 'node:path';
import { padPilotNumber, parseFeedRanking, placeLabel } from '@aero-judge/utils';
import { Resvg } from '@resvg/resvg-js';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';

const WIDTH = 1200;
const HEIGHT = 630;
const CACHE_MS = 60_000;

export interface RankingCardInput {
  place: number;
  board: 'OVERALL' | 'TEAM';
  name: string;
  teamName: string | null;
  scoreText: string | null;
  pilotNumber: number | null;
  countryCode: string | null;
  photoUrl: string | null;
  competitionName: string | null;
}

const pngCache = new Map<string, { at: number; png: Buffer }>();

function siteOrigin(): string {
  try {
    const url = new URL(env.PUBLIC_RESULTS_URL);
    if (url.pathname && url.pathname !== '/') return `${url.protocol}//${url.host}`;
    return url.origin;
  } catch {
    return env.publicApiUrl;
  }
}

/** Public card image. Served outside /api so crawlers blocked from /api can still fetch it. */
export function rankingOgImageUrl(itemId: string): string {
  return `${siteOrigin()}/og/feed/${encodeURIComponent(itemId)}.png`;
}

export async function rankingOgPng(itemId: string): Promise<Buffer> {
  const cached = pngCache.get(itemId);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.png;

  const item = await prisma.eventFeedItem.findFirst({
    where: { id: itemId },
    select: {
      caption: true,
      pilotName: true,
      pilotNumber: true,
      pilotPhotoUrl: true,
      scoreText: true,
      reason: true,
      roundNumber: true,
      competition: {
        select: {
          name: true,
          isPublished: true,
          status: true,
          settings: { select: { livePublicResults: true } },
        },
      },
    },
  });
  const ranking = parseFeedRanking(item?.caption);
  const competition = item?.competition;
  const published =
    competition?.isPublished === true &&
    competition.status !== 'DRAFT' &&
    competition.status !== 'ARCHIVED' &&
    competition.settings?.livePublicResults === true;
  if (!item || !ranking || item.roundNumber == null || !published) {
    throw AppError.notFound('Result image not found');
  }

  const png = await renderRankingCardPng({
    place: item.roundNumber,
    board: ranking.board,
    name: item.pilotName?.trim() || 'Result',
    teamName: ranking.board === 'OVERALL' ? item.reason : null,
    scoreText: item.scoreText,
    pilotNumber: item.pilotNumber,
    countryCode: ranking.countryCode,
    photoUrl: item.pilotPhotoUrl,
    competitionName: competition?.name ?? null,
  });
  pngCache.set(itemId, { at: Date.now(), png });
  if (pngCache.size > 40) {
    const oldest = pngCache.keys().next().value;
    if (oldest) pngCache.delete(oldest);
  }
  return png;
}

export async function renderRankingCardPng(input: RankingCardInput): Promise<Buffer> {
  const photo = await inlineImage(input.photoUrl);
  const flag = input.countryCode ? await inlineFlag(input.countryCode) : null;
  const svg = rankingCardSvg(input, photo, flag);
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: WIDTH },
    font: {
      fontFiles: [fontFile('Roboto-Regular.ttf'), fontFile('Roboto-Bold.ttf')],
      loadSystemFonts: false,
      defaultFontFamily: 'Roboto',
    },
  });
  return Buffer.from(resvg.render().asPng());
}

function rankingCardSvg(input: RankingCardInput, photo: string | null, flag: string | null): string {
  const border = input.place === 1 ? '#e6c36a' : input.place === 2 ? '#d4d4d8' : input.place === 3 ? '#c9844a' : '#38bdf8';
  const badge = input.place === 1 ? '#e6c36a' : input.place === 2 ? '#e4e4e7' : input.place === 3 ? '#e0a36a' : '#7dd3fc';
  const score = scoreParts(input.scoreText);
  const bib = input.pilotNumber != null ? `#${padPilotNumber(input.pilotNumber)}` : '';
  const name = escapeXml(truncate(input.name.toUpperCase(), 42));
  const team = input.teamName ? escapeXml(truncate(input.teamName.toUpperCase(), 48)) : '';
  const event = input.competitionName ? escapeXml(truncate(input.competitionName.toUpperCase(), 42)) : '';
  const photoFit = input.board === 'TEAM' ? 'xMidYMid meet' : 'xMidYMid slice';
  const photoMark = photo
    ? `<image href="${photo}" x="64" y="64" width="500" height="502" clip-path="url(#photo)" preserveAspectRatio="${photoFit}"/>`
    : `<text x="314" y="340" text-anchor="middle" font-family="Roboto" font-size="120" font-weight="700" fill="#bae6fd">${escapeXml(initials(input.name))}</text>`;
  const flagMark = flag
    ? `<rect x="470" y="478" width="78" height="58" rx="14" fill="#000000" fill-opacity="0.65"/>
       <image href="${flag}" x="482" y="490" width="54" height="34" preserveAspectRatio="xMidYMid slice"/>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#071018"/>
  <rect x="40" y="28" width="1120" height="574" rx="36" fill="#1a140e" stroke="${border}" stroke-width="6"/>
  <clipPath id="photo"><rect x="64" y="64" width="500" height="502" rx="24"/></clipPath>
  <rect x="64" y="64" width="500" height="502" rx="24" fill="#102033"/>
  ${photoMark}
  <rect x="84" y="84" width="132" height="64" rx="16" fill="#000000" fill-opacity="0.72"/>
  <text x="150" y="126" text-anchor="middle" font-family="Roboto" font-size="32" font-weight="700" fill="${badge}" letter-spacing="3">${escapeXml(placeLabel(input.place, 'badge'))}</text>
  ${bib ? `<rect x="400" y="84" width="140" height="64" rx="16" fill="#000000" fill-opacity="0.72"/>
    <text x="470" y="126" text-anchor="middle" font-family="Roboto" font-size="32" font-weight="700" fill="#ffffff">${escapeXml(bib)}</text>` : ''}
  ${flagMark}
  ${event ? `<text x="860" y="160" text-anchor="middle" font-family="Roboto" font-size="22" fill="#93c5fd" letter-spacing="2">${event}</text>` : ''}
  <text x="860" y="300" text-anchor="middle" font-family="Roboto" font-size="108" font-weight="700" fill="#ffffff">${escapeXml(score?.figure ?? '')}${score?.unit ? `<tspan font-size="36" font-weight="700" fill="#38bdf8" dx="16">${escapeXml(score.unit)}</tspan>` : ''}</text>
  ${team ? `<text x="860" y="370" text-anchor="middle" font-family="Roboto" font-size="26" font-weight="700" fill="#e6c36a" letter-spacing="2">${team}</text>` : ''}
  <text x="860" y="${team ? 450 : 400}" text-anchor="middle" font-family="Roboto" font-size="40" font-weight="700" fill="#ffffff">${name}</text>
</svg>`;
}

function scoreParts(scoreText: string | null): { figure: string; unit: string | null } | null {
  if (!scoreText) return null;
  const match = scoreText.match(/^(.*?)\s+cm$/i);
  if (!match?.[1]) return { figure: scoreText, unit: null };
  return { figure: match[1], unit: 'cm' };
}

function initials(name: string): string {
  const words = name.split(/\s+/).filter((word) => word && word.toLowerCase() !== 'team');
  const letters = words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? '').join('');
  return letters || name.slice(0, 2).toUpperCase() || '·';
}

function fontFile(name: string): string {
  const candidates = [
    path.resolve(process.cwd(), 'public/fonts', name),
    path.resolve(process.cwd(), 'server/public/fonts', name),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error(`Share-image font not found: ${name}`);
  return found;
}

async function inlineImage(url: string | null): Promise<string | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  return fetchImageDataUri(url);
}

async function inlineFlag(code2: string): Promise<string | null> {
  if (!/^[A-Z]{2}$/.test(code2)) return null;
  return fetchImageDataUri(`https://flagcdn.com/w80/${code2.toLowerCase()}.png`);
}

async function fetchImageDataUri(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (!response.ok) return null;
    const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (type !== 'image/png' && type !== 'image/jpeg') return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > 2_000_000) return null;
    return `data:${type};base64,${bytes.toString('base64')}`;
  } catch {
    return null;
  }
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

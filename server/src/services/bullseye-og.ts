import { existsSync } from 'node:fs';
import path from 'node:path';
import { padPilotNumber } from '@aero-judge/utils';
import { Resvg } from '@resvg/resvg-js';
import { env } from '../config/env.js';
import { toAbsoluteAssetUrl } from '../utils/assets.js';
import { AppError } from '../utils/errors.js';
import { getPublicResults } from './public.service.js';

const WIDTH = 1200;
const HEIGHT = 630;
const MAX_ROWS = 6;
const MAX_ROUNDS = 5;
const CACHE_MS = 60_000;

export interface OgBullseyePilot {
  rank: number;
  name: string;
  bib: string;
  countryCode: string;
  countryCode2: string;
  photoUrl: string | null;
  rounds: number[];
}

interface RankingScore {
  round: number;
  isBullseye?: boolean;
  isProvisional?: boolean;
}

interface RankingRow {
  bullseyes?: number;
  totalScoreCm: number;
  roundScores?: RankingScore[];
  pilot?: {
    pilotNumber?: number | null;
    firstName?: string | null;
    lastName?: string | null;
    photoUrl?: string | null;
    country?: { code?: string | null; code2?: string | null } | null;
  } | null;
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

/** Public image path. Not under /api, which robots.txt blocks for crawlers. */
export function bullseyeOgImageUrl(slug: string): string {
  return `${siteOrigin()}/og/bullseyes/${encodeURIComponent(slug)}.png`;
}

export function rankBullseyePilots(rankings: RankingRow[]): OgBullseyePilot[] {
  const rows = rankings.flatMap((row) => {
    const pilot = row.pilot;
    if (!pilot) return [];
    const rounds = (row.roundScores ?? [])
      .filter((score) => score.isBullseye && !score.isProvisional)
      .map((score) => score.round)
      .sort((a, b) => a - b);
    const count = Math.max(row.bullseyes ?? 0, rounds.length);
    if (count < 1) return [];
    const name = `${pilot.firstName ?? ''} ${pilot.lastName ?? ''}`.trim() || 'Pilot';
    return [
      {
        rank: 0,
        count,
        totalScoreCm: row.totalScoreCm,
        name,
        bib: pilot.pilotNumber != null ? padPilotNumber(pilot.pilotNumber) : '',
        countryCode: (pilot.country?.code ?? '').toUpperCase(),
        countryCode2: (pilot.country?.code2 ?? '').toUpperCase(),
        photoUrl: toAbsoluteAssetUrl(pilot.photoUrl) ?? pilot.photoUrl ?? null,
        rounds: rounds.slice(0, MAX_ROUNDS),
      },
    ];
  });

  rows.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (a.totalScoreCm !== b.totalScoreCm) return a.totalScoreCm - b.totalScoreCm;
    return a.name.localeCompare(b.name);
  });

  let rank = 0;
  let previousCount = -1;
  return rows.map((row, index) => {
    if (row.count !== previousCount) {
      rank = index + 1;
      previousCount = row.count;
    }
    return {
      rank,
      name: row.name,
      bib: row.bib,
      countryCode: row.countryCode,
      countryCode2: row.countryCode2,
      photoUrl: row.photoUrl,
      rounds: row.rounds,
    };
  });
}

export async function bullseyeOgPng(slug: string): Promise<Buffer> {
  const cached = pngCache.get(slug);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.png;

  let pilots: OgBullseyePilot[] = [];
  try {
    const results = await getPublicResults(slug, 'OVERALL');
    pilots = rankBullseyePilots(results.rankings as RankingRow[]).slice(0, MAX_ROWS);
  } catch (error) {
    if (!(error instanceof AppError) || error.statusCode !== 404) throw error;
  }

  const png = await renderBullseyeCardPng(pilots);
  pngCache.set(slug, { at: Date.now(), png });
  if (pngCache.size > 40) {
    const oldest = pngCache.keys().next().value;
    if (oldest) pngCache.delete(oldest);
  }
  return png;
}

export async function renderBullseyeCardPng(pilots: OgBullseyePilot[]): Promise<Buffer> {
  const photos = await Promise.all(pilots.map((pilot) => inlineImage(pilot.photoUrl)));
  const flags = await Promise.all(pilots.map((pilot) => inlineFlag(pilot.countryCode2)));
  const svg = bullseyeCardSvg(pilots, photos, flags);
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

function bullseyeCardSvg(
  pilots: OgBullseyePilot[],
  photos: Array<string | null>,
  flags: Array<string | null>,
): string {
  const rowH = 92;
  const cardW = 1104;
  const cardH = Math.max(rowH + 8, pilots.length * rowH + 8);
  const cardX = (WIDTH - cardW) / 2;
  const cardY = Math.max(24, (HEIGHT - cardH) / 2);
  const columns = Math.max(1, ...pilots.map((pilot) => pilot.rounds.length));
  const rows =
    pilots.length === 0
      ? emptyRow(cardX, cardY, cardW, rowH)
      : pilots
          .map((pilot, index) =>
            pilotRow({
              pilot,
              photo: photos[index] ?? null,
              flag: flags[index] ?? null,
              x: cardX,
              y: cardY + 4 + index * rowH,
              width: cardW,
              height: rowH,
              columns,
              divider: index < pilots.length - 1,
            }),
          )
          .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#eef3f8"/>
  <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="28" fill="#ffffff" stroke="#e6edf5"/>
  ${rows}
</svg>`;
}

function emptyRow(x: number, y: number, width: number, height: number): string {
  return `<text x="${x + width / 2}" y="${y + height / 2 + 6}" text-anchor="middle" font-family="Roboto" font-size="28" fill="#64748b">No bullseyes yet</text>`;
}

function pilotRow(input: {
  pilot: OgBullseyePilot;
  photo: string | null;
  flag: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  columns: number;
  divider: boolean;
}): string {
  const { pilot, photo, flag, x, y, width, height, columns, divider } = input;
  const cy = y + height / 2;
  const rank = rankBadge(x + 52, cy, pilot.rank);
  const photoMark = avatar(x + 118, cy, photo, `p${pilot.rank}-${pilot.bib}`);
  const name = escapeXml(truncate(pilot.name, 28));
  const bib = pilot.bib
    ? `<rect x="${x + 168}" y="${cy + 6}" width="46" height="22" rx="11" fill="#0f2744"/>
       <text x="${x + 191}" y="${cy + 22}" text-anchor="middle" font-family="Roboto" font-size="13" font-weight="700" fill="#ffffff">${escapeXml(pilot.bib)}</text>`
    : '';
  const flagMark = flag
    ? `<image href="${flag}" x="${x + 222}" y="${cy + 8}" width="22" height="16" preserveAspectRatio="xMidYMid slice"/>`
    : '';
  const codeX = flag ? x + 250 : x + 222;
  const code = pilot.countryCode
    ? `<text x="${codeX}" y="${cy + 21}" font-family="Roboto" font-size="13" fill="#64748b">${escapeXml(pilot.countryCode)}</text>`
    : '';
  const scores = scoreMarks(pilot.rounds, columns, x + width - 36, cy);
  const line = divider
    ? `<line x1="${x + 24}" y1="${y + height}" x2="${x + width - 24}" y2="${y + height}" stroke="#e8eef5"/>`
    : '';

  return `${line}
    ${rank}
    ${photoMark}
    <text x="${x + 168}" y="${cy - 8}" font-family="Roboto" font-size="26" font-weight="700" fill="#0f172a">${name}</text>
    ${bib}
    ${flagMark}
    ${code}
    ${scores}`;
}

function scoreMarks(rounds: number[], columns: number, right: number, cy: number): string {
  const colW = 78;
  return rounds
    .map((round, index) => {
      const cx = right - (columns - 1 - index) * colW;
      return `<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-family="Roboto" font-size="22" font-weight="700" fill="#22c55e">000</text>
        <text x="${cx}" y="${cy + 20}" text-anchor="middle" font-family="Roboto" font-size="14" fill="#94a3b8">R${round}</text>`;
    })
    .join('');
}

function rankBadge(cx: number, cy: number, rank: number): string {
  const palette =
    rank === 1
      ? { fill: '#fef3c7', stroke: '#f59e0b', text: '#b45309' }
      : rank === 2
        ? { fill: '#f1f5f9', stroke: '#94a3b8', text: '#64748b' }
        : rank === 3
          ? { fill: '#ffedd5', stroke: '#fb923c', text: '#c2410c' }
          : { fill: '#f8fafc', stroke: '#cbd5e1', text: '#64748b' };
  return `<circle cx="${cx}" cy="${cy}" r="18" fill="${palette.fill}" stroke="${palette.stroke}" stroke-width="1.5"/>
    <text x="${cx}" y="${cy + 6}" text-anchor="middle" font-family="Roboto" font-size="16" font-weight="700" fill="${palette.text}">${rank}</text>`;
}

function avatar(cx: number, cy: number, href: string | null, id: string): string {
  const r = 28;
  if (!href) {
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#e2e8f0"/>`;
  }
  return `<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
    <image href="${href}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e2e8f0"/>`;
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
  return fetchImageDataUri(`https://flagcdn.com/w40/${code2.toLowerCase()}.png`);
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
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

import { open } from 'node:fs/promises';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { feedItemId } from '@aero-judge/utils';
import { resolveLocalUploadPath, toAbsoluteAssetUrl } from '../utils/assets.js';
import { AppError } from '../utils/errors.js';
import {
  blogSlugFromPath,
  renderBlogArticleHtml,
  renderBlogIndexHtml,
} from './blog-article.js';
import { getCompetitionBlog, listCompetitionBlogSummaries } from './blog.service.js';
import { getPublicCareer, getPublicCompetition, getPublicFeedItem } from './public.service.js';

export type SeoMeta = {
  title: string;
  description: string;
  url: string;
  image: string;
  imageAlt?: string;
  /** Pixel size. Facebook will not draw og:image on the first share without both. */
  imageWidth?: number;
  imageHeight?: number;
  imageType?: string;
  siteName: string;
  type: 'website' | 'article';
  robots?: string;
  /** Trusted HTML built by the blog renderer. Callers must not pass raw user HTML. */
  articleHtml?: string;
  jsonLd?: Record<string, unknown>;
};

export type OpenGraphImageSize = {
  width: number;
  height: number;
  type?: string;
};

const imageSizeCache = new Map<string, OpenGraphImageSize | null>();

function positivePixel(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 200 || parsed > 20000) return null;
  return parsed;
}

/** Read Cloudinary's delivered size from the server-timing header. */
export function imageSizeFromHeaders(headers: {
  get(name: string): string | null;
}): OpenGraphImageSize | null {
  const timing = headers.get('server-timing') ?? '';
  const match = timing.match(/width=(\d+),height=(\d+)/);
  const width = positivePixel(match?.[1]);
  const height = positivePixel(match?.[2]);
  if (!width || !height) return null;
  const type = headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  return {
    width,
    height,
    type: type && /^image\/(jpeg|png|gif|webp)$/.test(type) ? type : undefined,
  };
}

/**
 * Facebook renders a share image on the first preview only when it already
 * knows the pixel size. Cloudinary reports that size on a HEAD request.
 */
export async function readOpenGraphImageSize(url: string): Promise<OpenGraphImageSize | null> {
  if (imageSizeCache.has(url)) return imageSizeCache.get(url) ?? null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com') return null;

  let size: OpenGraphImageSize | null = null;
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(2500),
    });
    if (response.ok) size = imageSizeFromHeaders(response.headers);
  } catch {
    size = null;
  }
  imageSizeCache.set(url, size);
  return size;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Public events app base without trailing slash (may include `/events` path prefix). */
export function publicResultsBaseUrl(): string {
  return env.PUBLIC_RESULTS_URL.replace(/\/+$/, '');
}

/** Marketing / site origin (parent of /events when path-deployed). */
export function publicSiteOrigin(): string {
  try {
    const u = new URL(env.PUBLIC_RESULTS_URL);
    // http://host/events → http://host
    if (u.pathname && u.pathname !== '/') {
      return `${u.protocol}//${u.host}`;
    }
    return u.origin;
  } catch {
    return env.publicApiUrl;
  }
}

export function defaultOgImageUrl(): string {
  return `${publicSiteOrigin()}/og-default.svg`;
}

/** Hero photo when the event has one, otherwise the site share image. */
export function competitionShareImage(heroImageUrl: string | null | undefined): string {
  return toAbsoluteAssetUrl(heroImageUrl) || defaultOgImageUrl();
}

/** Width and height from a PNG, JPEG, or WebP header. */
export function imageSizeFromBuffer(buffer: Buffer): OpenGraphImageSize | null {
  if (buffer.length >= 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
    const width = positivePixel(String(buffer.readUInt32BE(16)));
    const height = positivePixel(String(buffer.readUInt32BE(20)));
    if (!width || !height) return null;
    return { width, height, type: 'image/png' };
  }

  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1] ?? 0;
      const length = buffer.readUInt16BE(offset + 2);
      const isStartOfFrame =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isStartOfFrame) {
        const width = positivePixel(String(buffer.readUInt16BE(offset + 7)));
        const height = positivePixel(String(buffer.readUInt16BE(offset + 5)));
        if (!width || !height) return null;
        return { width, height, type: 'image/jpeg' };
      }
      if (length < 2) break;
      offset += 2 + length;
    }
  }

  if (
    buffer.length >= 30 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    const format = buffer.toString('ascii', 12, 16);
    if (format === 'VP8X') {
      const width = positivePixel(String(1 + buffer.readUIntLE(24, 3)));
      const height = positivePixel(String(1 + buffer.readUIntLE(27, 3)));
      if (width && height) return { width, height, type: 'image/webp' };
    }
  }

  return null;
}

async function shareImageSize(url: string): Promise<OpenGraphImageSize | null> {
  const remote = await readOpenGraphImageSize(url);
  if (remote) return remote;
  const localPath = resolveLocalUploadPath(url);
  if (!localPath) return null;
  let handle: Awaited<ReturnType<typeof open>> | null = null;
  try {
    handle = await open(localPath, 'r');
    const buffer = Buffer.alloc(1024 * 1024);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return imageSizeFromBuffer(buffer.subarray(0, bytesRead));
  } catch {
    return null;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

/** Known SPA path prefixes (current + legacy). */
const PUBLIC_APP_PREFIXES = ['/events', '/results'] as const;

function publicAppBasePath(): string {
  try {
    const pathname = new URL(publicResultsBaseUrl()).pathname.replace(/\/+$/, '');
    return pathname && pathname !== '/' ? pathname : '';
  } catch {
    return '';
  }
}

function absolutePublicUrl(pathname: string): string {
  const base = publicResultsBaseUrl();
  let path = pathname.startsWith('/') ? pathname : `/${pathname}`;

  // Avoid double prefix when path already includes the app mount (or a legacy mount)
  try {
    const origin = new URL(base).origin;
    const basePath = publicAppBasePath();
    for (const prefix of PUBLIC_APP_PREFIXES) {
      if (path === prefix || path.startsWith(`${prefix}/`)) {
        // Rewrite legacy /results → configured base (/events)
        if (basePath && prefix !== basePath && path.startsWith(prefix)) {
          path = basePath + path.slice(prefix.length);
        }
        return `${origin}${path === '/' ? '' : path}`;
      }
    }
  } catch {
    // fall through
  }

  return `${base}${path === '/' ? '' : path}`;
}

/**
 * Normalize request path from browser or gateway.
 * Accepts `/events/competition/x/results`, legacy `/results/...`, or `/competition/x/results`.
 */
export function normalizePublicPath(raw: string): string {
  let path = (raw.split('?')[0] || '/').trim() || '/';
  if (!path.startsWith('/')) path = `/${path}`;
  // strip trailing slash except root
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  for (const prefix of PUBLIC_APP_PREFIXES) {
    if (path === prefix) return '/';
    if (path.startsWith(`${prefix}/`)) {
      path = path.slice(prefix.length) || '/';
      break;
    }
  }
  return path || '/';
}

type PageKind =
  | { kind: 'list' }
  | { kind: 'competition'; slug: string; section: string };

function parsePublicPage(path: string): PageKind {
  if (path === '/' || path === '') return { kind: 'list' };

  const modern = path.match(/^\/competition\/([^/]+)(?:\/(.*))?$/);
  if (modern) {
    return {
      kind: 'competition',
      slug: decodeURIComponent(modern[1]),
      section: modern[2] || '',
    };
  }

  // legacy /:slug/...
  const legacy = path.match(/^\/([^/]+)(?:\/(.*))?$/);
  if (legacy) {
    return {
      kind: 'competition',
      slug: decodeURIComponent(legacy[1]),
      section: legacy[2] || '',
    };
  }

  return { kind: 'list' };
}

async function resolvePilotSeo(aeroJudgeId: string): Promise<SeoMeta> {
  const siteName = 'AeroJudge';
  const url = absolutePublicUrl(`/pilots/${encodeURIComponent(aeroJudgeId)}`);
  try {
    const career = await getPublicCareer(aeroJudgeId);
    const description = `${career.displayName} — paragliding accuracy on AeroJudge.`;
    return {
      title: `${career.displayName} · AeroJudge`,
      description,
      url,
      image: career.photoUrl || defaultOgImageUrl(),
      siteName,
      type: 'website',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: career.displayName,
        url,
        image: career.photoUrl || undefined,
      },
    };
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 404) {
      return {
        title: 'Pilot not found · AeroJudge',
        description: 'This pilot profile is not published.',
        url,
        image: defaultOgImageUrl(),
        siteName,
        type: 'website',
        robots: 'noindex, nofollow',
      };
    }
    throw error;
  }
}

function sectionLabel(section: string): string {
  const root = section.split('/')[0] || '';
  switch (root) {
    case '':
      return 'Overview';
    case 'results':
      return 'Results';
    case 'pilots':
      return section.includes('/') ? 'Pilot profile' : 'Pilots';
    case 'register':
      return 'Registration';
    case 'women':
      return 'Women';
    case 'teams':
      return 'Teams';
    case 'countries':
      return 'Countries';
    case 'event':
    case 'feed':
      return 'Feed';
    case 'statistics':
      return 'Statistics';
    case 'bullseyes':
      return 'Bullseyes';
    default:
      return 'Results';
  }
}

function formatDateRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  try {
    if (start.toDateString() === end.toDateString()) {
      return start.toLocaleDateString('en-GB', opts);
    }
    return `${start.toLocaleDateString('en-GB', opts)} – ${end.toLocaleDateString('en-GB', opts)}`;
  } catch {
    return '';
  }
}

const DEFAULT_DESCRIPTION =
  'Live and official Paragliding Accuracy results on AeroJudge — rankings, pilots, teams and statistics.';

async function resolveBlogSeo(path: string): Promise<SeoMeta> {
  const siteName = 'AeroJudge';
  const image = defaultOgImageUrl();
  const origin = publicSiteOrigin();
  const kind = blogSlugFromPath(path);

  if (kind === 'index') {
    const posts = await listCompetitionBlogSummaries();
    const url = `${origin}/blog`;
    const description =
      'Stories from completed paragliding accuracy competitions — winners, venues and official results on AeroJudge.';
    return {
      title: 'Competition stories · AeroJudge',
      description,
      url,
      image,
      siteName,
      type: 'website',
      articleHtml: renderBlogIndexHtml(posts),
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: 'AeroJudge competition stories',
        description,
        url,
      },
    };
  }

  const slug = kind ?? '';
  const url = `${origin}/blog/${encodeURIComponent(slug)}`;
  try {
    const article = await getCompetitionBlog(slug);
    const canonical = `${origin}/blog/${encodeURIComponent(article.slug)}`;
    return {
      title: `${article.title} · AeroJudge`,
      description: article.description,
      url: canonical,
      image: article.coverImage || image,
      siteName,
      type: 'article',
      articleHtml: renderBlogArticleHtml(article),
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'BlogPosting',
            headline: article.title,
            description: article.description,
            datePublished: article.publishedAt,
            dateModified: article.publishedAt,
            mainEntityOfPage: canonical,
            author: article.organizer
              ? { '@type': 'Organization', name: article.organizer }
              : { '@type': 'Organization', name: siteName },
            image: article.coverImage || image,
            publisher: { '@type': 'Organization', name: siteName, url: origin },
            about: {
              '@type': 'SportsEvent',
              name: article.title.replace(/ results$/i, ''),
              startDate: article.startDate,
              endDate: article.endDate,
              eventStatus: 'https://schema.org/EventCompleted',
              location:
                article.venue || article.country
                  ? { '@type': 'Place', name: article.venue, address: article.country || undefined }
                  : undefined,
              organizer: article.organizer
                ? { '@type': 'Organization', name: article.organizer }
                : undefined,
            },
          },
          ...(article.faqs.length
            ? [
                {
                  '@type': 'FAQPage',
                  mainEntity: article.faqs.map((faq) => ({
                    '@type': 'Question',
                    name: faq.question,
                    acceptedAnswer: { '@type': 'Answer', text: faq.answer },
                  })),
                },
              ]
            : []),
        ],
      },
    };
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 404) {
      return {
        title: 'Story not found · AeroJudge',
        description: 'This competition story is not published.',
        url,
        image,
        siteName,
        type: 'article',
        robots: 'noindex, nofollow',
      };
    }
    throw error;
  }
}

/** `/competition/:slug/feed/:itemId` — a single public update. */
export function feedItemFromPath(path: string): { slug: string; itemId: string } | null {
  const match = path.match(/^\/competition\/([^/]+)\/feed\/([^/]+)$/);
  if (!match?.[1] || !match[2]) return null;
  try {
    return {
      slug: decodeURIComponent(match[1]),
      itemId: feedItemId(decodeURIComponent(match[2])),
    };
  } catch {
    return { slug: match[1], itemId: feedItemId(match[2]) };
  }
}

function oneLine(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

/** Share-preview and crawler metadata for one public feed update. */
export function buildFeedItemSeo(input: {
  slug: string;
  item: {
    id: string;
    kind: string;
    caption: string | null;
    body: string;
    imageUrl: string | null;
    pilotName: string | null;
    scoreText: string | null;
    roundNumber: number | null;
    createdAt: string;
  };
  competition: {
    name: string;
    venue?: string | null;
    country?: string | null;
  };
}): SeoMeta {
  const { item, competition } = input;
  const place = [competition.venue, competition.country].filter(Boolean).join(', ');
  const headline =
    item.kind === 'SCORE' && item.pilotName
      ? `${item.pilotName} — Round ${item.roundNumber ?? ''} ${item.scoreText ?? ''}`.replace(/\s+/g, ' ').trim()
      : item.kind === 'REFLIGHT' && item.pilotName
        ? `${item.pilotName} — reflight`
        : oneLine(item.caption) || oneLine(item.body) || 'Event update';
  const shortHeadline = headline.length > 90 ? `${headline.slice(0, 87)}…` : headline;
  const title = `${shortHeadline} — ${competition.name} · Paragliding Accuracy`;
  const description = [
    headline,
    `${competition.name} paragliding accuracy${place ? ` in ${place}` : ''}.`,
  ]
    .join(' ')
    .slice(0, 300);
  const url = absolutePublicUrl(`/competition/${encodeURIComponent(input.slug)}/feed/${encodeURIComponent(item.id)}`);
  const image = item.imageUrl || defaultOgImageUrl();
  const imageAlt = item.imageUrl ? shortHeadline : title;
  const figure = item.imageUrl
    ? `<figure><img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(imageAlt)}" /><figcaption>${escapeHtml(shortHeadline)}</figcaption></figure><p>${escapeHtml(description)}</p>`
    : undefined;

  return {
    title,
    description,
    url,
    image,
    imageAlt,
    siteName: 'AeroJudge',
    type: item.imageUrl ? 'article' : 'website',
    articleHtml: figure,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': item.imageUrl ? 'ImageObject' : 'NewsArticle',
      name: imageAlt,
      headline: shortHeadline,
      description,
      caption: item.imageUrl ? shortHeadline : undefined,
      contentUrl: item.imageUrl || undefined,
      url,
      image,
      datePublished: item.createdAt,
      about: {
        '@type': 'SportsEvent',
        name: competition.name,
        sport: 'Paragliding Accuracy',
        location: place || undefined,
      },
    },
  };
}

async function resolveFeedItemSeo(slug: string, itemId: string): Promise<SeoMeta> {
  const url = absolutePublicUrl(
    `/competition/${encodeURIComponent(slug)}/feed/${encodeURIComponent(itemId)}`,
  );
  try {
    const [competition, item] = await Promise.all([
      getPublicCompetition(slug),
      getPublicFeedItem(slug, itemId),
    ]);
    const meta = buildFeedItemSeo({
      slug: competition.publicSlug || competition.id,
      item,
      competition,
    });
    if (item.imageUrl) {
      const size = await readOpenGraphImageSize(item.imageUrl);
      if (size) {
        meta.imageWidth = size.width;
        meta.imageHeight = size.height;
        meta.imageType = size.type;
      }
    }
    return meta;
  } catch (error) {
    if (error instanceof AppError && (error.statusCode === 404 || error.statusCode === 403)) {
      return {
        title: 'Update not found · AeroJudge',
        description: 'This paragliding accuracy update is not published.',
        url,
        image: defaultOgImageUrl(),
        siteName: 'AeroJudge',
        type: 'website',
        robots: 'noindex, nofollow',
      };
    }
    throw error;
  }
}

/** `/pilots/:aeroJudgeId` on the events app. Not a competition slug. */
export function pilotIdFromPath(path: string): string | null {
  const match = path.match(/^\/pilots\/([^/]+)$/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export async function resolveSeoMeta(rawPath: string): Promise<SeoMeta> {
  const path = normalizePublicPath(rawPath);
  if (blogSlugFromPath(path)) {
    return resolveBlogSeo(path);
  }
  const pilotId = pilotIdFromPath(path);
  if (pilotId) return resolvePilotSeo(pilotId);
  const feedItem = feedItemFromPath(path);
  if (feedItem) return resolveFeedItemSeo(feedItem.slug, feedItem.itemId);
  const page = parsePublicPage(path);
  const siteName = 'AeroJudge';
  const image = defaultOgImageUrl();

  if (page.kind === 'list') {
    const url = absolutePublicUrl('/');
    return {
      title: 'AeroJudge · Public Competition Results',
      description:
        'Browse live and completed Paragliding Accuracy competitions — rankings, pilots, teams and official results on AeroJudge.',
      url,
      image,
      siteName,
      type: 'website',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: siteName,
        url,
        description: DEFAULT_DESCRIPTION,
      },
    };
  }

  const competition = await prisma.competition.findFirst({
    where: {
      isPublished: true,
      status: { notIn: ['DRAFT', 'ARCHIVED'] },
      OR: [{ id: page.slug }, { publicSlug: page.slug }],
      settings: { livePublicResults: true },
    },
    select: {
      id: true,
      name: true,
      organizer: true,
      venue: true,
      country: true,
      startDate: true,
      endDate: true,
      status: true,
      publicSlug: true,
      info: { select: { heroImageUrl: true } },
      _count: {
        select: {
          pilots: true,
          rounds: { where: { type: 'OFFICIAL' } },
        },
      },
    },
  });

  if (!competition) {
    const url = absolutePublicUrl(path);
    return {
      title: 'Competition not found · AeroJudge',
      description: 'This competition is not available on the public results site.',
      url,
      image,
      siteName,
      type: 'website',
      robots: 'noindex, nofollow',
    };
  }

  const slug = competition.publicSlug || competition.id;
  const section = page.section;
  const label = sectionLabel(section);
  const dates = formatDateRange(competition.startDate, competition.endDate);
  const place = [competition.venue, competition.country].filter(Boolean).join(', ');
  const statusLabel = competition.status.replace(/_/g, ' ').toLowerCase();
  const title =
    label === 'Overview'
      ? `${competition.name} · AeroJudge`
      : `${competition.name} — ${label} · AeroJudge`;

  const parts = [
    competition.organizer ? `Organized by ${competition.organizer}.` : null,
    place || null,
    dates || null,
    competition._count.pilots
      ? `${competition._count.pilots} pilots · ${competition._count.rounds} official rounds · ${statusLabel}.`
      : `Status: ${statusLabel}.`,
    DEFAULT_DESCRIPTION,
  ].filter(Boolean);

  const description = parts.join(' ').slice(0, 300);
  const canonicalPath =
    section === '' ? `/competition/${slug}` : `/competition/${slug}/${section}`;
  const url = absolutePublicUrl(canonicalPath);
  const shareImage = competitionShareImage(competition.info?.heroImageUrl);
  const shareSize = shareImage === image ? null : await shareImageSize(shareImage);

  return {
    title,
    description,
    url,
    image: shareImage,
    imageAlt: competition.name,
    imageWidth: shareSize?.width,
    imageHeight: shareSize?.height,
    imageType: shareSize?.type,
    siteName,
    type: 'website',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'SportsEvent',
      name: competition.name,
      description,
      url,
      startDate: competition.startDate.toISOString(),
      endDate: competition.endDate.toISOString(),
      eventStatus:
        competition.status === 'COMPLETED'
          ? 'https://schema.org/EventCompleted'
          : 'https://schema.org/EventScheduled',
      location: place
        ? {
            '@type': 'Place',
            name: competition.venue,
            address: competition.country || undefined,
          }
        : undefined,
      organizer: competition.organizer
        ? { '@type': 'Organization', name: competition.organizer }
        : undefined,
      image: shareImage,
    },
  };
}

export function renderSeoHtml(meta: SeoMeta): string {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const url = escapeHtml(meta.url);
  const image = escapeHtml(meta.image);
  const imageAlt = escapeHtml(meta.imageAlt || meta.title);
  const imageWidth = positivePixel(meta.imageWidth ? String(meta.imageWidth) : undefined);
  const imageHeight = positivePixel(meta.imageHeight ? String(meta.imageHeight) : undefined);
  const imageType =
    meta.imageType && /^image\/(jpeg|png|gif|webp)$/.test(meta.imageType)
      ? escapeHtml(meta.imageType)
      : '';
  const imageSizeTags =
    imageWidth && imageHeight
      ? `<meta property="og:image:width" content="${imageWidth}" />\n  <meta property="og:image:height" content="${imageHeight}" />`
      : '';
  const imageTypeTag = imageType
    ? `<meta property="og:image:type" content="${imageType}" />`
    : '';
  const siteName = escapeHtml(meta.siteName);
  const robots = escapeHtml(meta.robots || 'index, follow');
  const jsonLd = meta.jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(meta.jsonLd).replace(/</g, '\\u003c')}</script>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta name="robots" content="${robots}" />
  <link rel="canonical" href="${url}" />
  <meta property="og:type" content="${meta.type}" />
  <meta property="og:site_name" content="${siteName}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${image}" />
  ${imageTypeTag}
  ${imageSizeTags}
  <meta property="og:image:alt" content="${imageAlt}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
  <meta name="theme-color" content="#0a1628" />
  <style>main p,main li{color:#334155;line-height:1.6}main a{color:#0284c7}main ol,main ul{padding-left:1.25rem}main h2{font-size:1.25rem;margin:1.5rem 0 0.5rem}main h3{font-size:1rem;margin:1rem 0 0.25rem}main table{width:100%;border-collapse:collapse;margin:1rem 0}main th,main td{border-bottom:1px solid #e2e8f0;padding:0.35rem 0.5rem;text-align:left}</style>
  ${jsonLd}
</head>
<body>
  <main style="font-family:system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem;color:#0a1628">
    <p style="color:#0369a1;font-size:0.75rem;font-weight:600;letter-spacing:0.12em;text-transform:uppercase">${siteName}</p>
    <h1 style="font-size:1.75rem;line-height:1.2">${title}</h1>
    ${
      meta.articleHtml ??
      `<p style="color:#334155;line-height:1.55">${description}</p>`
    }
    <p><a href="${url}" style="color:#0284c7">Open live page →</a></p>
  </main>
</body>
</html>`;
}

export async function buildSitemapXml(): Promise<string> {
  const site = publicSiteOrigin();
  const resultsBase = publicResultsBaseUrl();
  const now = new Date().toISOString();

  const competitions = await prisma.competition.findMany({
    where: {
      isPublished: true,
      settings: { livePublicResults: true },
      status: { notIn: ['DRAFT', 'ARCHIVED'] },
    },
    select: {
      id: true,
      publicSlug: true,
      updatedAt: true,
      status: true,
      _count: { select: { teams: true } },
    },
    orderBy: { startDate: 'desc' },
    take: 500,
  });

  const stories = await listCompetitionBlogSummaries();
  const urls: Array<{
    loc: string;
    lastmod?: string;
    priority: string;
    changefreq: string;
    image?: { loc: string; caption?: string };
  }> = [
    { loc: `${site}/`, priority: '1.0', changefreq: 'weekly', lastmod: now },
    { loc: `${site}/blog`, priority: '0.7', changefreq: 'weekly', lastmod: now },
    { loc: `${site}/privacy`, priority: '0.3', changefreq: 'yearly' },
    { loc: `${site}/terms`, priority: '0.3', changefreq: 'yearly' },
    { loc: `${resultsBase}/`, priority: '0.9', changefreq: 'hourly', lastmod: now },
  ];

  for (const story of stories) {
    urls.push({
      loc: `${site}/blog/${encodeURIComponent(story.slug)}`,
      lastmod: story.publishedAt,
      priority: '0.7',
      changefreq: 'monthly',
    });
  }

  const photos = await prisma.eventFeedItem.findMany({
    where: {
      imageUrl: { not: null },
      competition: {
        isPublished: true,
        status: { notIn: ['DRAFT', 'ARCHIVED'] },
        settings: { livePublicResults: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 500,
    select: {
      id: true,
      imageUrl: true,
      caption: true,
      body: true,
      updatedAt: true,
      competition: { select: { id: true, publicSlug: true } },
    },
  });
  for (const photo of photos) {
    if (!photo.imageUrl) continue;
    const slug = photo.competition.publicSlug || photo.competition.id;
    const caption = oneLine(photo.caption) || oneLine(photo.body);
    urls.push({
      loc: `${resultsBase}/competition/${encodeURIComponent(slug)}/feed/${encodeURIComponent(photo.id)}`,
      lastmod: photo.updatedAt.toISOString(),
      priority: '0.6',
      changefreq: 'monthly',
      image: {
        loc: toAbsoluteAssetUrl(photo.imageUrl) ?? photo.imageUrl,
        caption: caption || undefined,
      },
    });
  }

  for (const c of competitions) {
    const slug = c.publicSlug || c.id;
    const lastmod = c.updatedAt.toISOString();
    const live = c.status !== 'COMPLETED';
    const pri = live ? '0.85' : '0.8';
    const freq = live ? 'hourly' : 'weekly';
    const base = `${resultsBase}/competition/${slug}`;
    urls.push(
      { loc: base, lastmod, priority: pri, changefreq: freq },
      { loc: `${base}/results`, lastmod, priority: pri, changefreq: freq },
      { loc: `${base}/pilots`, lastmod, priority: '0.7', changefreq: freq },
      { loc: `${base}/event`, lastmod, priority: '0.6', changefreq: 'weekly' },
      { loc: `${base}/bullseyes`, lastmod, priority: '0.5', changefreq: freq },
    );
    if (c._count.teams > 0) {
      urls.push({ loc: `${base}/teams`, lastmod, priority: '0.6', changefreq: 'weekly' });
    }
  }

  const publicPilots = await prisma.pilot.findMany({
    where: {
      pilotNumber: { not: null },
      status: { notIn: ['REGISTERED', 'REJECTED', 'WITHDRAWN', 'DISQUALIFIED', 'DNS'] },
      competition: {
        isPublished: true,
        status: { notIn: ['DRAFT', 'ARCHIVED'] },
        settings: { livePublicResults: true },
      },
    },
    select: {
      pilotNumber: true,
      updatedAt: true,
      competition: { select: { id: true, publicSlug: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 5000,
  });
  for (const pilot of publicPilots) {
    if (pilot.pilotNumber == null) continue;
    const slug = pilot.competition.publicSlug || pilot.competition.id;
    urls.push({
      loc: `${resultsBase}/competition/${slug}/pilots/${pilot.pilotNumber}`,
      lastmod: pilot.updatedAt.toISOString(),
      priority: '0.5',
      changefreq: 'weekly',
    });
  }

  const body = urls
    .map((u) => {
      const image = u.image
        ? `
    <image:image>
      <image:loc>${escapeHtml(u.image.loc)}</image:loc>
      ${u.image.caption ? `<image:caption>${escapeHtml(u.image.caption)}</image:caption>` : ''}
    </image:image>`
        : '';
      return `  <url>
    <loc>${escapeHtml(u.loc)}</loc>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>${image}
  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${body}
</urlset>
`;
}

export function robotsTxt(): string {
  const site = publicSiteOrigin();
  return `User-agent: *
Allow: /
Allow: /blog/
Allow: /events/
Allow: /results/
Disallow: /admin/
Disallow: /judge/
Disallow: /api/

Sitemap: ${site}/sitemap.xml
`;
}

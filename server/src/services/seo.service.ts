import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';

export type SeoMeta = {
  title: string;
  description: string;
  url: string;
  image: string;
  siteName: string;
  type: 'website' | 'article';
  robots?: string;
  jsonLd?: Record<string, unknown>;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Public results base without trailing slash (may include `/results` path prefix). */
export function publicResultsBaseUrl(): string {
  return env.PUBLIC_RESULTS_URL.replace(/\/+$/, '');
}

/** Marketing / site origin (parent of /results when path-deployed). */
export function publicSiteOrigin(): string {
  try {
    const u = new URL(env.PUBLIC_RESULTS_URL);
    // http://host/results → http://host
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

function absolutePublicUrl(pathname: string): string {
  const base = publicResultsBaseUrl();
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  // Avoid double /results when path already includes it
  if (path.startsWith('/results/') && base.endsWith('/results')) {
    return `${base.replace(/\/results$/, '')}${path}`;
  }
  if (path === '/results' && base.endsWith('/results')) {
    return base;
  }
  return `${base}${path === '/' ? '' : path}`;
}

/**
 * Normalize request path from browser or gateway.
 * Accepts `/results/competition/x/results` or `/competition/x/results`.
 */
export function normalizePublicPath(raw: string): string {
  let path = (raw.split('?')[0] || '/').trim() || '/';
  if (!path.startsWith('/')) path = `/${path}`;
  // strip trailing slash except root
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  // strip /results app prefix for routing logic
  if (path === '/results') return '/';
  if (path.startsWith('/results/')) path = path.slice('/results'.length) || '/';
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
    case 'statistics':
      return 'Statistics';
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

export async function resolveSeoMeta(rawPath: string): Promise<SeoMeta> {
  const path = normalizePublicPath(rawPath);
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

  return {
    title,
    description,
    url,
    image,
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
      image,
    },
  };
}

export function renderSeoHtml(meta: SeoMeta): string {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const url = escapeHtml(meta.url);
  const image = escapeHtml(meta.image);
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
  <meta property="og:image:alt" content="${title}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
  <meta name="theme-color" content="#0a1628" />
  ${jsonLd}
</head>
<body>
  <main style="font-family:system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem;color:#0a1628">
    <p style="color:#0369a1;font-size:0.75rem;font-weight:600;letter-spacing:0.12em;text-transform:uppercase">${siteName}</p>
    <h1 style="font-size:1.75rem;line-height:1.2">${title}</h1>
    <p style="color:#334155;line-height:1.55">${description}</p>
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
    select: { id: true, publicSlug: true, updatedAt: true, status: true },
    orderBy: { startDate: 'desc' },
    take: 500,
  });

  const urls: Array<{ loc: string; lastmod?: string; priority: string; changefreq: string }> = [
    { loc: `${site}/`, priority: '1.0', changefreq: 'weekly', lastmod: now },
    { loc: `${resultsBase}/`, priority: '0.9', changefreq: 'hourly', lastmod: now },
  ];

  for (const c of competitions) {
    const slug = c.publicSlug || c.id;
    const lastmod = c.updatedAt.toISOString();
    const pri = c.status === 'COMPLETED' ? '0.8' : '0.85';
    urls.push(
      {
        loc: `${resultsBase}/competition/${slug}`,
        lastmod,
        priority: pri,
        changefreq: c.status === 'COMPLETED' ? 'weekly' : 'hourly',
      },
      {
        loc: `${resultsBase}/competition/${slug}/results`,
        lastmod,
        priority: pri,
        changefreq: c.status === 'COMPLETED' ? 'weekly' : 'hourly',
      },
    );
  }

  const body = urls
    .map(
      (u) => `  <url>
    <loc>${escapeHtml(u.loc)}</loc>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

export function robotsTxt(): string {
  const site = publicSiteOrigin();
  return `User-agent: *
Allow: /
Allow: /results/
Disallow: /admin/
Disallow: /judge/
Disallow: /api/

Sitemap: ${site}/sitemap.xml
`;
}

export interface CompetitionLinkTarget {
  competitionId: string;
  layout: string | null;
  /** True when the website path is the results page. The screen is the same board. */
  results: boolean;
}

/**
 * Map a website or app URL onto a competition screen.
 * Display and Events paths both resolve to the native competition board.
 */
export function competitionTargetFromUrl(input: string): CompetitionLinkTarget | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  const layout = url.searchParams.get('layout')?.trim() || null;
  const path = normalizePath(url);
  const display = path.match(/^\/display\/competition\/([^/]+)\/?$/);
  if (display?.[1]) {
    return { competitionId: decodeURIComponent(display[1]), layout, results: false };
  }

  const events = path.match(/^\/events\/competition\/([^/]+)(?:\/([^/]+))?\/?$/);
  if (events?.[1]) {
    const section = events[2] ?? '';
    if (section && section !== 'results') return null;
    return {
      competitionId: decodeURIComponent(events[1]),
      layout,
      results: section === 'results',
    };
  }

  const native = path.match(/^\/competition\/([^/]+)(?:\/([^/]+))?\/?$/);
  if (native?.[1]) {
    const section = native[2] ?? '';
    if (section && section !== 'results') return null;
    return {
      competitionId: decodeURIComponent(native[1]),
      layout,
      results: section === 'results',
    };
  }

  return null;
}

export function hrefForCompetitionTarget(target: CompetitionLinkTarget): string {
  const path = target.results
    ? `/competition/${encodeURIComponent(target.competitionId)}/results`
    : `/competition/${encodeURIComponent(target.competitionId)}`;
  if (!target.layout) return path;
  return `${path}?layout=${encodeURIComponent(target.layout)}`;
}

function normalizePath(url: URL): string {
  if (url.protocol === 'aerojudge:') {
    const host = url.hostname;
    const pathname = url.pathname.startsWith('/') ? url.pathname : `/${url.pathname}`;
    return host ? `/${host}${pathname === '/' ? '' : pathname}` : pathname;
  }
  return url.pathname;
}

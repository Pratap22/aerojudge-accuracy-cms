import { useParams } from 'react-router-dom';

/** Competition id from the URL path – shareable, no localStorage. */
export function useCompetitionId(): string | undefined {
  const { competitionId } = useParams<{ competitionId: string }>();
  return competitionId;
}

/** Organization id from nested competition (or org) routes. */
export function useRouteOrganizationId(): string | undefined {
  const { organizationId } = useParams<{ organizationId: string }>();
  return organizationId;
}

export function competitionsListPath(organizationId: string): string {
  return `/organizations/${organizationId}/competitions`;
}

export function archivedCompetitionsPath(organizationId: string): string {
  return `/organizations/${organizationId}/competitions/archived`;
}

export function competitionPath(
  organizationId: string,
  competitionId: string,
  segment = '',
): string {
  const base = `/organizations/${organizationId}/competitions/${competitionId}`;
  if (!segment || segment === '/') return base;
  return `${base}/${segment.replace(/^\//, '')}`;
}

/** Parse org + competition ids from an admin pathname (nested or legacy). */
export function parseCompetitionLocation(pathname: string): {
  organizationId?: string;
  competitionId?: string;
  isArchivedList?: boolean;
  isCompetitionsList?: boolean;
} {
  const nestedArchived = pathname.match(
    /^\/organizations\/([^/]+)\/competitions\/archived(?:\/|$)/,
  );
  if (nestedArchived) {
    return { organizationId: nestedArchived[1], isArchivedList: true };
  }

  const nested = pathname.match(/^\/organizations\/([^/]+)\/competitions(?:\/([^/]+))?/);
  if (nested) {
    const organizationId = nested[1];
    const competitionId = nested[2];
    if (!competitionId) {
      return { organizationId, isCompetitionsList: true };
    }
    if (competitionId === 'archived') {
      return { organizationId, isArchivedList: true };
    }
    return { organizationId, competitionId };
  }

  // Legacy paths (pre org-nested URLs)
  if (pathname === '/competitions' || pathname === '/competitions/') {
    return { isCompetitionsList: true };
  }
  if (pathname.startsWith('/competitions/archived')) {
    return { isArchivedList: true };
  }
  const legacy = pathname.match(/^\/competitions\/([^/]+)/);
  if (legacy && legacy[1] !== 'archived') {
    return { competitionId: legacy[1] };
  }
  return {};
}

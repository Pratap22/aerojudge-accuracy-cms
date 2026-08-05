import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import {
  archivedCompetitionsPath,
  competitionPath,
  competitionsListPath,
} from '../hooks/useCompetitionId';

/**
 * Sends users to the active organization's competitions list once auth is ready.
 */
export function ActiveOrgCompetitionsRedirect({
  archived = false,
}: {
  archived?: boolean;
}) {
  const { activeOrganizationId, user, isLoading, requiresOrganizationSelection } = useAuth();
  const orgId = activeOrganizationId ?? user?.organizationId ?? null;

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-secondary border-t-transparent" />
      </div>
    );
  }

  if (requiresOrganizationSelection || !orgId) {
    return <Navigate to="/organizations" replace />;
  }

  return (
    <Navigate
      to={archived ? archivedCompetitionsPath(orgId) : competitionsListPath(orgId)}
      replace
    />
  );
}

/**
 * Rewrites legacy `/competitions/:competitionId/...` URLs to the nested org form
 * using the active organization (or org id from competition payload when available).
 */
export function LegacyCompetitionRedirect() {
  const { competitionId, '*': rest } = useParams<{ competitionId: string; '*': string }>();
  const { activeOrganizationId, user, isLoading } = useAuth();
  const location = useLocation();
  const orgId = activeOrganizationId ?? user?.organizationId ?? null;

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-secondary border-t-transparent" />
      </div>
    );
  }

  if (!orgId || !competitionId || competitionId === 'archived') {
    return <Navigate to="/competitions" replace />;
  }

  const segment = rest?.replace(/^\//, '') ?? '';
  const target = competitionPath(orgId, competitionId, segment);
  return <Navigate to={`${target}${location.search}${location.hash}`} replace />;
}

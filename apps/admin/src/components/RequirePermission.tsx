import { Navigate, useLocation, useParams } from 'react-router-dom';
import type { Permission } from '@npha/shared';
import { useAuth } from '../lib/auth';
import { checkPermission, useAnyPermission } from '../hooks/usePermission';
import { competitionPath, competitionsListPath } from '../hooks/useCompetitionId';

interface RequirePermissionProps {
  /** Any one of these permissions grants access. */
  anyOf: readonly Permission[];
  children: React.ReactNode;
  /** Where to send the user when denied (default: competitions list). */
  fallback?: string;
}

/**
 * Route guard — redirects when the active org membership lacks required permissions.
 */
export function RequirePermission({ anyOf, children, fallback }: RequirePermissionProps) {
  const { user, isLoading, activeOrganizationId } = useAuth();
  const location = useLocation();
  const { competitionId, organizationId: routeOrganizationId } = useParams<{
    competitionId: string;
    organizationId: string;
  }>();
  const allowed = useAnyPermission(anyOf);
  const orgId = routeOrganizationId ?? activeOrganizationId ?? user?.organizationId ?? null;

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-secondary border-t-transparent" />
      </div>
    );
  }

  if (!allowed) {
    const scoringFallback =
      competitionId && orgId && checkPermission(user, 'score:enter')
        ? competitionPath(orgId, competitionId, 'scoring')
        : orgId
          ? competitionsListPath(orgId)
          : '/competitions';
    return <Navigate to={fallback ?? scoringFallback} replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

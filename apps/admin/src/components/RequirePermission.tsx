import { Navigate, useLocation, useParams } from 'react-router-dom';
import type { Permission } from '@npha/shared';
import { useAuth } from '../lib/auth';
import { checkPermission, useAnyPermission } from '../hooks/usePermission';
import { competitionPath } from '../hooks/useCompetitionId';

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
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const { competitionId } = useParams<{ competitionId: string }>();
  const allowed = useAnyPermission(anyOf);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-secondary border-t-transparent" />
      </div>
    );
  }

  if (!allowed) {
    const scoringFallback =
      competitionId && checkPermission(user, 'score:enter')
        ? competitionPath(competitionId, 'scoring')
        : '/competitions';
    return <Navigate to={fallback ?? scoringFallback} replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

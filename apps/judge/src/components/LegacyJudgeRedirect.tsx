import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { getOrganizationId } from '../lib/api';
import { roundsPath, scorePath } from '../lib/paths';

/** Send old /rounds and /score links to the organization and competition path. */
export function LegacyJudgeRedirect() {
  const { roundId } = useParams();
  const { isAuthenticated, isLoading, requiresOrganizationSelection, competitionId } = useAuth();
  const organizationId = getOrganizationId();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated || requiresOrganizationSelection || !organizationId || !competitionId) {
    return <Navigate to="/login" replace />;
  }

  if (roundId) {
    return <Navigate to={scorePath(organizationId, competitionId, roundId)} replace />;
  }

  return <Navigate to={roundsPath(organizationId, competitionId)} replace />;
}

import { useEffect, useState } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { getOrganizationId } from '../lib/api';
import { useAuth } from '../lib/auth';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, requiresOrganizationSelection, organizations, selectOrganization } =
    useAuth();
  const location = useLocation();
  const { organizationId } = useParams();
  const [aligningOrg, setAligningOrg] = useState(false);

  const sessionOrgId = getOrganizationId();
  const orgMismatch = Boolean(organizationId && sessionOrgId !== organizationId);
  const canUseRouteOrg = organizations.some(
    (org) => org.organizationId === organizationId && org.status === 'ACTIVE',
  );

  useEffect(() => {
    if (!isAuthenticated || !organizationId || !orgMismatch || !canUseRouteOrg) return;
    let cancelled = false;
    setAligningOrg(true);
    void selectOrganization(organizationId).finally(() => {
      if (!cancelled) setAligningOrg(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, organizationId, orgMismatch, canUseRouteOrg, selectOrganization]);

  if (isLoading || aligningOrg || (orgMismatch && canUseRouteOrg)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated || requiresOrganizationSelection) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (organizationId && organizations.length > 0 && !canUseRouteOrg) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

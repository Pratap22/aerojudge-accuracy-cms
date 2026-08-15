import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, requiresOrganizationSelection } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-secondary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Multi-org sessions without an active tenant must pick one before workspace routes.
  // Otherwise Competitions links bounce back to /organizations and the sidebar select
  // can look selected while activeOrganizationId is still null.
  if (requiresOrganizationSelection) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

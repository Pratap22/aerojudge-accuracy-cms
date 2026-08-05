import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@npha/shared';
import { Building2, Target } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@npha/ui';
import { useAuth } from '../lib/auth';
import { competitionsListPath } from '../hooks/useCompetitionId';
import { ApiError } from '../lib/api';
import { redirectToPreferredStaffAppIfNeeded } from '../lib/staff-app';

export function LoginPage() {
  const {
    login,
    selectOrganization,
    isAuthenticated,
    requiresOrganizationSelection,
    organizations,
    activeOrganizationId,
    user,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const requestedFrom = (location.state as { from?: Location })?.from?.pathname;
  const defaultHome = activeOrganizationId
    ? competitionsListPath(activeOrganizationId)
    : '/competitions';
  const from = requestedFrom && requestedFrom !== '/login' ? requestedFrom : defaultHome;

  if (isAuthenticated && !requiresOrganizationSelection && !selecting) {
    if (user && redirectToPreferredStaffAppIfNeeded(user)) {
      return null;
    }
    navigate(from, { replace: true });
    return null;
  }

  const onSubmit = async (data: LoginInput) => {
    setError(null);
    try {
      const result = await login(data.email, data.password);
      if (result.requiresOrganizationSelection) {
        setSelecting(true);
        return;
      }
      if (redirectToPreferredStaffAppIfNeeded(result.user)) {
        return;
      }
      const orgId = result.user.organizationId;
      const dest =
        requestedFrom && requestedFrom !== '/login'
          ? requestedFrom
          : orgId
            ? competitionsListPath(orgId)
            : '/competitions';
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed. Check your credentials.');
    }
  };

  const onSelectOrg = async (organizationId: string) => {
    setError(null);
    try {
      const result = await selectOrganization(organizationId);
      setSelecting(false);
      if (redirectToPreferredStaffAppIfNeeded(result.user)) {
        return;
      }
      const dest =
        requestedFrom && requestedFrom !== '/login'
          ? requestedFrom
          : competitionsListPath(organizationId);
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to select organization.');
    }
  };

  const showSelector = selecting || requiresOrganizationSelection;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
            <Target className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl">AeroJudge</CardTitle>
            <CardDescription>
              {showSelector
                ? 'Select an organization to continue'
                : 'Professional competition management for air sports'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {showSelector ? (
            <div className="space-y-3">
              {organizations
                .filter((o) => o.status === 'ACTIVE')
                .map((org) => (
                  <Button
                    key={org.organizationId}
                    variant="outline"
                    className="flex h-auto w-full items-start justify-start gap-3 p-4 text-left"
                    onClick={() => void onSelectOrg(org.organizationId)}
                  >
                    <Building2 className="mt-0.5 h-5 w-5 shrink-0" />
                    <span>
                      <span className="block font-semibold">{org.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {org.shortName} · {org.role.replace(/_/g, ' ')}
                      </span>
                    </span>
                  </Button>
                ))}
              {error && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" {...register('email')} />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  {...register('password')}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>
              {error && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

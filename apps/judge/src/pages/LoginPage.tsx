import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@npha/shared';
import { Building2, Target } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@npha/ui';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';
import { redirectToPreferredStaffAppIfNeeded } from '../lib/staff-app';

export function LoginPage() {
  const {
    login,
    selectOrganization,
    isAuthenticated,
    requiresOrganizationSelection,
    organizations,
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

  const from = (location.state as { from?: Location })?.from?.pathname ?? '/rounds';
  const showSelector = selecting || requiresOrganizationSelection;

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
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
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
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to select organization');
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-sky-500">
          <Target className="h-8 w-8 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">AeroJudge</h1>
          <p className="text-muted-foreground">Judge scoring terminal</p>
        </div>
      </div>

      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">
            {showSelector ? 'Select organization' : 'Sign in to score'}
          </CardTitle>
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
                    className="flex h-auto w-full items-start justify-start gap-3 border-border bg-muted/40 p-4 text-left text-foreground hover:bg-muted"
                    onClick={() => void onSelectOrg(org.organizationId)}
                  >
                    <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" />
                    <span>
                      <span className="block font-semibold">{org.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {org.shortName} · {(org.customRoleName ?? org.role).replace(/_/g, ' ')}
                      </span>
                    </span>
                  </Button>
                ))}
              {error && (
                <div className="rounded-lg bg-destructive/20 px-4 py-3 text-sm text-red-300">{error}</div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-muted-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="judge@example.com"
                  className="h-12 border-input bg-background text-lg text-foreground placeholder:text-muted-foreground"
                  {...register('email')}
                />
                {errors.email && <p className="text-sm text-red-400">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="password" className="text-muted-foreground">
                    Password
                  </Label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-sky-400 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="h-12 border-input bg-background text-lg text-foreground placeholder:text-muted-foreground"
                  {...register('password')}
                />
                {errors.password && (
                  <p className="text-sm text-red-400">{errors.password.message}</p>
                )}
              </div>
              {error && (
                <div className="rounded-lg bg-destructive/20 px-4 py-3 text-sm text-red-300">{error}</div>
              )}
              <Button type="submit" size="lg" className="h-14 w-full text-lg" disabled={isSubmitting}>
                {isSubmitting ? 'Signing in…' : 'Start Scoring Session'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

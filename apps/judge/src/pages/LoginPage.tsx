import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@npha/shared';
import { Building2, Target } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@npha/ui';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';

export function LoginPage() {
  const {
    login,
    selectOrganization,
    isAuthenticated,
    requiresOrganizationSelection,
    organizations,
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
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    }
  };

  const onSelectOrg = async (organizationId: string) => {
    setError(null);
    try {
      await selectOrganization(organizationId);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to select organization');
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950 p-6">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-sky-500">
          <Target className="h-8 w-8 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">AeroJudge</h1>
          <p className="text-slate-400">Judge scoring terminal</p>
        </div>
      </div>

      <Card className="w-full max-w-md border-slate-700 bg-slate-800/50">
        <CardHeader>
          <CardTitle className="text-white">
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
                    className="flex h-auto w-full items-start justify-start gap-3 border-slate-600 bg-slate-900/50 p-4 text-left text-white hover:bg-slate-700"
                    onClick={() => void onSelectOrg(org.organizationId)}
                  >
                    <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" />
                    <span>
                      <span className="block font-semibold">{org.name}</span>
                      <span className="text-xs text-slate-400">
                        {org.shortName} · {(org.customRoleName ?? org.role).replace(/_/g, ' ')}
                      </span>
                    </span>
                  </Button>
                ))}
              {error && (
                <div className="rounded-lg bg-red-500/20 px-4 py-3 text-sm text-red-300">{error}</div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="h-12 border-slate-600 bg-slate-900 text-lg"
                  {...register('email')}
                />
                {errors.email && <p className="text-sm text-red-400">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  className="h-12 border-slate-600 bg-slate-900 text-lg"
                  {...register('password')}
                />
                {errors.password && (
                  <p className="text-sm text-red-400">{errors.password.message}</p>
                )}
              </div>
              {error && (
                <div className="rounded-lg bg-red-500/20 px-4 py-3 text-sm text-red-300">{error}</div>
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

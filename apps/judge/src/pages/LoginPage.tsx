import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@npha/shared';
import { Building2, Flag, Target } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@npha/ui';
import { useAuth } from '../lib/auth';
import { api, ApiError, getOrganizationId } from '../lib/api';
import { parseJudgeLocation, roundsPath } from '../lib/paths';
import { redirectToPreferredStaffAppIfNeeded } from '../lib/staff-app';

const HIDDEN_COMPETITION_STATUSES = new Set(['ARCHIVED', 'CANCELLED']);

interface CompetitionChoice {
  id: string;
  name: string;
  code: string;
  status?: string;
}

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
  const [step, setStep] = useState<'form' | 'organization' | 'competition'>('form');
  const [competitions, setCompetitions] = useState<CompetitionChoice[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    if (!isAuthenticated || requiresOrganizationSelection) {
      if (requiresOrganizationSelection) setStep('organization');
      return;
    }
    if (step === 'competition') return;
    if (user && redirectToPreferredStaffAppIfNeeded(user)) return;

    const orgId = getOrganizationId();
    if (!orgId) return;

    let cancelled = false;

    void (async () => {
      try {
        const list = await api.get<CompetitionChoice[]>('/competitions', { pageSize: 200 });
        if (cancelled) return;
        const visible = list.filter(
          (competition) => !competition.status || !HIDDEN_COMPETITION_STATUSES.has(competition.status),
        );
        const fromPath =
          (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '';
        const parsed = parseJudgeLocation(fromPath);
        if (
          parsed.organizationId === orgId &&
          parsed.competitionId &&
          visible.some((competition) => competition.id === parsed.competitionId)
        ) {
          navigate(fromPath, { replace: true });
          return;
        }
        if (visible.length === 1) {
          navigate(roundsPath(orgId, visible[0].id), { replace: true });
          return;
        }
        setCompetitions(visible);
        setStep('competition');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Failed to load competitions');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, requiresOrganizationSelection, step, user, location.state, navigate]);

  const onSubmit = async (data: LoginInput) => {
    setError(null);
    try {
      await login(data.email, data.password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    }
  };

  const onSelectOrg = async (organizationId: string) => {
    setError(null);
    try {
      await selectOrganization(organizationId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to select organization');
    }
  };

  const onSelectCompetition = (competitionId: string) => {
    const orgId = getOrganizationId();
    if (!orgId) return;
    navigate(roundsPath(orgId, competitionId), { replace: true });
  };

  const showOrganization = step === 'organization' || requiresOrganizationSelection;
  const showCompetition = step === 'competition' && !showOrganization;

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
            {showOrganization
              ? 'Select organization'
              : showCompetition
                ? 'Select competition'
                : 'Sign in to score'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {showOrganization ? (
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
          ) : showCompetition ? (
            <div className="space-y-3">
              {competitions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  This organization has no competitions yet.
                </p>
              ) : (
                competitions.map((competition) => (
                  <Button
                    key={competition.id}
                    variant="outline"
                    className="flex h-auto w-full items-start justify-start gap-3 border-border bg-muted/40 p-4 text-left text-foreground hover:bg-muted"
                    onClick={() => onSelectCompetition(competition.id)}
                  >
                    <Flag className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" />
                    <span>
                      <span className="block font-semibold">{competition.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {competition.code}
                        {competition.status && competition.status !== 'OFFICIAL'
                          ? ` · ${competition.status.replace(/_/g, ' ').toLowerCase()}`
                          : ''}
                      </span>
                    </span>
                  </Button>
                ))
              )}
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

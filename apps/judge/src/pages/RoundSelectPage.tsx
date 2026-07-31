import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ClipboardList, LogOut, Target } from 'lucide-react';
import { Badge, Button, Card, CardContent } from '@npha/ui';
import type { RoundStatus } from '@npha/shared';
import { api, getOrganizationId } from '../lib/api';
import { useAuth } from '../lib/auth';

interface RoundOption {
  id: string;
  number: number;
  name: string;
  status: RoundStatus;
  flightsScored: number;
  flightsTotal: number;
}

interface CompetitionOption {
  id: string;
  name: string;
  code: string;
  status?: string;
}

const statusVariant: Record<
  RoundStatus,
  'default' | 'secondary' | 'success' | 'warning' | 'outline'
> = {
  SCHEDULED: 'outline',
  BRIEFING: 'secondary',
  OPEN: 'secondary',
  ACTIVE: 'success',
  PAUSED: 'warning',
  CLOSED: 'default',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'default',
  LOCKED: 'default',
  CANCELLED: 'outline',
};

const SCORABLE_STATUSES: RoundStatus[] = [
  'BRIEFING',
  'OPEN',
  'ACTIVE',
  'PAUSED',
  'CLOSED',
  'PENDING_APPROVAL',
];

export function RoundSelectPage() {
  const { user, competitionId, setCompetitionId, logout, currentOrganization } = useAuth();
  const navigate = useNavigate();

  const orgId = currentOrganization?.organizationId ?? getOrganizationId();

  const { data: competitions, isLoading: compsLoading, error: compsError } = useQuery({
    queryKey: ['competitions', orgId],
    queryFn: () => api.get<CompetitionOption[]>('/competitions'),
    enabled: !!orgId,
    refetchInterval: 10_000,
  });

  // Ignore a stale competitionId left in localStorage from a previous/deleted competition.
  const activeCompId =
    (competitionId && competitions?.some((c) => c.id === competitionId)
      ? competitionId
      : undefined) ?? competitions?.[0]?.id;
  const activeCompetition = competitions?.find((c) => c.id === activeCompId);

  useEffect(() => {
    if (!competitions?.length) return;
    if (competitionId && !competitions.some((c) => c.id === competitionId)) {
      setCompetitionId(activeCompId ?? null);
      return;
    }
    if (!competitionId && activeCompId) {
      setCompetitionId(activeCompId);
    }
  }, [competitions, competitionId, activeCompId, setCompetitionId]);

  const {
    data: rounds,
    isLoading: roundsLoading,
    error: roundsError,
  } = useQuery({
    queryKey: ['rounds', activeCompId],
    queryFn: () => api.get<RoundOption[]>(`/competitions/${activeCompId}/rounds`),
    enabled: !!activeCompId,
    refetchInterval: 5_000,
  });

  const roundsNormalized = (rounds ?? []).map((r) => {
    const raw = r as RoundOption & { _count?: { flights?: number; scores?: number } };
    return {
      ...r,
      flightsTotal: r.flightsTotal ?? raw._count?.flights ?? 0,
      flightsScored: r.flightsScored ?? raw._count?.scores ?? 0,
    };
  });

  const scorableRounds = roundsNormalized.filter((r) => SCORABLE_STATUSES.includes(r.status));
  const isLoading = compsLoading || (!!activeCompId && roundsLoading);

  const selectRound = (roundId: string) => {
    if (activeCompId) setCompetitionId(activeCompId);
    navigate(`/score/${roundId}`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <Target className="h-6 w-6 text-sky-400" />
          <div>
            <p className="font-semibold">Select Round</p>
            <p className="text-sm text-muted-foreground">
              {user?.firstName} {user?.lastName}
              {currentOrganization
                ? ` · ${currentOrganization.shortName} · ${(currentOrganization.customRoleName ?? currentOrganization.role).replace(/_/g, ' ')}`
                : user?.orgRole
                  ? ` · ${user.orgRole.replace(/_/g, ' ')}`
                  : ''}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground hover:text-foreground">
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </header>

      <main className="mx-auto max-w-2xl p-6">
        {(compsError || roundsError) && (
          <p className="mb-4 rounded-lg bg-destructive/20 px-4 py-3 text-sm text-red-300">
            {(compsError as Error | null)?.message ||
              (roundsError as Error | null)?.message ||
              'Failed to load competition data. Check organization context.'}
          </p>
        )}

        {competitions && competitions.length > 0 && (
          <div className="mb-6 space-y-2">
            {activeCompetition && (
              <p className="text-sm text-muted-foreground">
                Competition:{' '}
                <span className="font-medium text-foreground">{activeCompetition.name}</span>
                <span className="text-muted-foreground"> ({activeCompetition.code})</span>
              </p>
            )}
            {competitions.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {competitions.map((c) => (
                  <Button
                    key={c.id}
                    variant={c.id === activeCompId ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCompetitionId(c.id)}
                  >
                    {c.code}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}

        {isLoading ? (
          <p className="py-16 text-center text-muted-foreground">Loading rounds…</p>
        ) : !orgId ? (
          <EmptyState
            title="Organization required"
            body="Sign out and sign in again, then select your organization so competitions can load."
          />
        ) : !competitions?.length ? (
          <EmptyState
            title="No competition available"
            body="This organization has no competitions yet. Ask the Meet Director or Chief Judge to create a competition in Admin."
          />
        ) : !roundsNormalized.length ? (
          <EmptyState
            title="Competition is not started yet"
            body={
              activeCompetition
                ? `“${activeCompetition.name}” has no rounds. Contact the Chief Judge or Meet Director to create and start a round before scoring.`
                : 'No rounds have been created. Contact the Chief Judge or Meet Director to start the competition.'
            }
          />
        ) : scorableRounds.length === 0 ? (
          <EmptyState
            title="No round is open for scoring"
            body="Rounds exist but none are active yet. Ask the Chief Judge or Meet Director to open or start a round (status should be Open, Active, or Briefing)."
          >
            <div className="mt-6 space-y-2 text-left">
              {roundsNormalized.map((round) => (
                <div
                  key={round.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
                >
                  <span className="text-sm text-muted-foreground">
                    R{round.number} {round.name || ''}
                  </span>
                  <Badge variant={statusVariant[round.status]}>{round.status}</Badge>
                </div>
              ))}
            </div>
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {roundsNormalized.map((round) => {
              const scoringBlocked = ['APPROVED', 'LOCKED', 'CANCELLED', 'SCHEDULED'].includes(
                round.status,
              );
              const canScore = SCORABLE_STATUSES.includes(round.status);
              return (
                <Card
                  key={round.id}
                  className={
                    canScore
                      ? 'cursor-pointer border-border bg-card text-card-foreground transition-colors hover:border-sky-500/50 active:scale-[0.99]'
                      : 'border-border bg-card/60 text-card-foreground opacity-80'
                  }
                  onClick={canScore ? () => selectRound(round.id) : undefined}
                >
                  <CardContent className="flex items-center justify-between p-5">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-mono text-2xl font-bold text-sky-400">
                          R{round.number}
                        </span>
                        <span className="text-lg font-medium">
                          {round.name || `Round ${round.number}`}
                        </span>
                        <Badge variant={statusVariant[round.status]}>{round.status}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {round.flightsScored ?? 0}/{round.flightsTotal ?? 0} flights scored
                        {scoringBlocked && round.status === 'LOCKED'
                          ? ' · Final — scoring closed'
                          : ''}
                        {scoringBlocked && round.status === 'APPROVED'
                          ? ' · Approved — scoring closed'
                          : ''}
                        {round.status === 'SCHEDULED' ? ' · Not started' : ''}
                      </p>
                    </div>
                    {canScore ? (
                      <ChevronRight className="h-6 w-6 shrink-0 text-muted-foreground" />
                    ) : (
                      <span className="shrink-0 text-xs text-muted-foreground">View only</span>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-sky-500/15">
        <ClipboardList className="h-7 w-7 text-sky-400" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{body}</p>
      {children}
    </div>
  );
}

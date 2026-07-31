import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, LogOut, Target } from 'lucide-react';
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
}

const statusVariant: Record<RoundStatus, 'default' | 'secondary' | 'success' | 'warning'> = {
  SCHEDULED: 'outline' as 'default',
  BRIEFING: 'secondary',
  OPEN: 'secondary',
  ACTIVE: 'success',
  PAUSED: 'warning',
  CLOSED: 'default',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'default',
  LOCKED: 'default',
  CANCELLED: 'outline' as 'default',
};

export function RoundSelectPage() {
  const { user, competitionId, setCompetitionId, logout, currentOrganization } = useAuth();
  const navigate = useNavigate();

  const { data: competitions, isLoading: compsLoading, error: compsError } = useQuery({
    queryKey: ['competitions', currentOrganization?.organizationId ?? getOrganizationId()],
    queryFn: () => api.get<CompetitionOption[]>('/competitions'),
    enabled: !!(currentOrganization?.organizationId || getOrganizationId()),
  });

  const activeCompId = competitionId ?? competitions?.[0]?.id;

  const { data: rounds, isLoading } = useQuery({
    queryKey: ['rounds', activeCompId],
    queryFn: () => api.get<RoundOption[]>(`/competitions/${activeCompId}/rounds`),
    enabled: !!activeCompId,
  });

  // Normalize API shape (_count) → flightsScored / flightsTotal
  const roundsNormalized = (rounds ?? []).map((r) => {
    const raw = r as RoundOption & { _count?: { flights?: number; scores?: number } };
    return {
      ...r,
      flightsTotal: r.flightsTotal ?? raw._count?.flights ?? 0,
      flightsScored: r.flightsScored ?? raw._count?.scores ?? 0,
    };
  });

  const selectRound = (roundId: string) => {
    if (activeCompId) setCompetitionId(activeCompId);
    navigate(`/score/${roundId}`);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
        <div className="flex items-center gap-3">
          <Target className="h-6 w-6 text-sky-400" />
          <div>
            <p className="font-semibold">Select Round</p>
            <p className="text-sm text-slate-400">
              {user?.firstName} {user?.lastName}
              {currentOrganization
                ? ` · ${currentOrganization.shortName} · ${(currentOrganization.customRoleName ?? currentOrganization.role).replace(/_/g, ' ')}`
                : user?.orgRole
                  ? ` · ${user.orgRole.replace(/_/g, ' ')}`
                  : ''}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={logout} className="text-slate-400 hover:text-white">
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </header>

      <main className="mx-auto max-w-2xl p-6">
        {compsError && (
          <p className="mb-4 rounded-lg bg-red-500/20 px-4 py-3 text-sm text-red-300">
            {(compsError as Error).message || 'Failed to load competitions. Check organization context.'}
          </p>
        )}
        {!compsLoading && competitions?.length === 0 && (
          <p className="mb-4 text-center text-slate-400">
            No competitions in this organization yet.
          </p>
        )}
        {competitions && competitions.length > 1 && (
          <div className="mb-6 flex flex-wrap gap-2">
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

        {isLoading ? (
          <p className="text-center text-slate-400">Loading rounds…</p>
        ) : (
          <div className="space-y-3">
            {roundsNormalized.map((round) => {
              const scoringBlocked = ['APPROVED', 'LOCKED', 'CANCELLED', 'SCHEDULED'].includes(
                round.status,
              );
              const canScore = ['BRIEFING', 'OPEN', 'ACTIVE', 'PAUSED', 'CLOSED', 'PENDING_APPROVAL'].includes(
                round.status,
              );
              return (
              <Card
                key={round.id}
                className={
                  canScore
                    ? 'cursor-pointer border-slate-700 bg-slate-800 text-white transition-colors hover:border-sky-500/50 hover:bg-slate-750 active:scale-[0.99]'
                    : 'border-slate-800 bg-slate-900/60 text-white opacity-80'
                }
                onClick={canScore ? () => selectRound(round.id) : undefined}
              >
                <CardContent className="flex items-center justify-between p-5 text-white">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-2xl font-bold text-sky-400">R{round.number}</span>
                      <span className="text-lg font-medium text-slate-100">
                        {round.name || `Round ${round.number}`}
                      </span>
                      <Badge
                        variant={statusVariant[round.status]}
                        className="border-slate-600 text-slate-100"
                      >
                        {round.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">
                      {round.flightsScored ?? 0}/{round.flightsTotal ?? 0} flights scored
                      {scoringBlocked && round.status === 'LOCKED' ? ' · Final — scoring closed' : ''}
                      {scoringBlocked && round.status === 'APPROVED' ? ' · Approved — scoring closed' : ''}
                    </p>
                  </div>
                  {canScore ? (
                    <ChevronRight className="h-6 w-6 shrink-0 text-slate-400" />
                  ) : (
                    <span className="shrink-0 text-xs text-slate-500">View only</span>
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

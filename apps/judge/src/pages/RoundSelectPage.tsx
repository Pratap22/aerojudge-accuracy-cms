import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, ClipboardList, LogOut, Pause, Play, Plus, Target } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
} from '@aero-judge/ui';
import type { CompetitionStatus, RoundStatus } from '@aero-judge/shared';
import { api, ApiError, getOrganizationId } from '../lib/api';
import { useAuth } from '../lib/auth';
import { SwitchToAdminButton } from '../components/SwitchToAdminButton';
import { WindSpeedDialog, type WindDraft } from '../components/WindSpeedDialog';
import { roundsPath, scorePath } from '../lib/paths';

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
  status?: CompetitionStatus | string;
  maxRounds?: number;
}

/** Archived and cancelled competitions stay off the scoring terminal. */
const HIDDEN_COMPETITION_STATUSES = new Set<string>(['ARCHIVED', 'CANCELLED']);

function competitionLabel(competition: CompetitionOption): string {
  const status = competition.status?.replace(/_/g, ' ').toLowerCase();
  const suffix = status && status !== 'official' ? ` — ${status}` : '';
  return `${competition.name} (${competition.code})${suffix}`;
}

function isJudgeVisibleCompetition(c: CompetitionOption): boolean {
  if (!c.status) return true;
  return !HIDDEN_COMPETITION_STATUSES.has(c.status);
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

const STARTABLE_STATUSES: RoundStatus[] = ['SCHEDULED', 'BRIEFING', 'OPEN'];

/** Previous round must reach one of these before creating the next. */
const COMPLETED_FOR_NEXT: RoundStatus[] = [
  'CLOSED',
  'PENDING_APPROVAL',
  'APPROVED',
  'LOCKED',
  'CANCELLED',
];

export function RoundSelectPage() {
  const { organizationId: routeOrgId, competitionId: routeCompetitionId } = useParams();
  const {
    user,
    setCompetitionId,
    logout,
    currentOrganization,
    organizations,
  } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingWind, setPendingWind] = useState<
    { kind: 'start'; roundId: string } | { kind: 'create' } | null
  >(null);

  const orgId = routeOrgId ?? currentOrganization?.organizationId ?? getOrganizationId();
  const activeOrganizations = useMemo(
    () => organizations.filter((o) => o.status === 'ACTIVE'),
    [organizations],
  );

  const { data: competitionsRaw, isLoading: compsLoading, error: compsError } = useQuery({
    queryKey: ['competitions', orgId],
    queryFn: () => api.get<CompetitionOption[]>('/competitions', { pageSize: 200 }),
    enabled: !!orgId,
    refetchInterval: 10_000,
  });

  const competitions = useMemo(
    () => (competitionsRaw ?? []).filter(isJudgeVisibleCompetition),
    [competitionsRaw],
  );

  const activeCompId =
    routeCompetitionId && competitions.some((c) => c.id === routeCompetitionId)
      ? routeCompetitionId
      : undefined;
  const activeCompetition = competitions.find((c) => c.id === activeCompId);

  useEffect(() => {
    if (!activeCompId) return;
    setCompetitionId(activeCompId);
  }, [activeCompId, setCompetitionId]);

  useEffect(() => {
    if (compsLoading || !routeOrgId || !competitions.length) return;
    if (routeCompetitionId && competitions.some((c) => c.id === routeCompetitionId)) return;
    const next =
      competitions.find(
        (c) => c.status && !['COMPLETED', 'ARCHIVED', 'CANCELLED'].includes(c.status),
      ) ?? competitions[0];
    if (next) navigate(roundsPath(routeOrgId, next.id), { replace: true });
  }, [compsLoading, competitions, navigate, routeCompetitionId, routeOrgId]);

  const handleOrganizationChange = (organizationId: string) => {
    if (!organizationId || organizationId === orgId) return;
    setPendingWind(null);
    setActionError(null);
    navigate(`/organizations/${organizationId}`);
  };

  const { data: competitionDetail } = useQuery({
    queryKey: ['competition', activeCompId],
    queryFn: () => api.get<CompetitionOption>(`/competitions/${activeCompId}`),
    enabled: !!activeCompId,
  });

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

  const roundsNormalized = useMemo(
    () =>
      (rounds ?? []).map((r) => {
        const raw = r as RoundOption & { _count?: { flights?: number; scores?: number } };
        return {
          ...r,
          flightsTotal: r.flightsTotal ?? raw._count?.flights ?? 0,
          flightsScored: r.flightsScored ?? raw._count?.scores ?? 0,
        };
      }),
    [rounds],
  );

  const scorableRounds = roundsNormalized.filter((r) => SCORABLE_STATUSES.includes(r.status));
  const isLoading = compsLoading || (!!activeCompId && roundsLoading);

  const maxRounds = competitionDetail?.maxRounds ?? activeCompetition?.maxRounds ?? 12;
  const nextNumber = (roundsNormalized.reduce((m, r) => Math.max(m, r.number), 0) || 0) + 1;
  const atMax = roundsNormalized.length >= maxRounds;
  const previousRound = useMemo(() => {
    if (roundsNormalized.length === 0) return null;
    return [...roundsNormalized].sort((a, b) => b.number - a.number)[0];
  }, [roundsNormalized]);
  const previousCompleted =
    !previousRound || COMPLETED_FOR_NEXT.includes(previousRound.status);
  const competitionAcceptsRounds =
    !!activeCompetition?.status &&
    !['COMPLETED', 'ARCHIVED', 'CANCELLED'].includes(activeCompetition.status);
  const canCreateNext = !!activeCompId && !atMax && previousCompleted && competitionAcceptsRounds;

  const { data: latestWind } = useQuery({
    queryKey: ['wind', activeCompId],
    queryFn: () =>
      api.get<{ speedMs: number; directionDeg: number } | null>(
        `/competitions/${activeCompId}/weather/wind/latest`,
      ),
    enabled: !!activeCompId,
  });

  const invalidateRounds = () => {
    queryClient.invalidateQueries({ queryKey: ['rounds', activeCompId] });
    queryClient.invalidateQueries({ queryKey: ['competition', activeCompId] });
  };

  const startMutation = useMutation({
    mutationFn: async ({
      roundId,
      resume,
      wind,
    }: {
      roundId: string;
      resume?: boolean;
      wind?: WindDraft;
    }) => {
      setActionError(null);
      if (wind) {
        await api.post(`/competitions/${activeCompId}/weather/wind`, {
          speedMs: wind.speedMs,
          directionDeg: wind.directionDeg,
          source: 'round-start',
        });
      }
      const action = resume ? 'resume' : 'start';
      return api.post<{ id: string }>(
        `/competitions/${activeCompId}/rounds/${roundId}/${action}`,
      );
    },
    onSuccess: (round) => {
      setPendingWind(null);
      invalidateRounds();
      if (activeCompId && routeOrgId) {
        setCompetitionId(activeCompId);
        navigate(scorePath(routeOrgId, activeCompId, round.id));
      }
    },
    onError: (err) => {
      setActionError(err instanceof ApiError ? err.message : 'Failed to start round');
    },
  });

  const createAndStartMutation = useMutation({
    mutationFn: async (wind: WindDraft) => {
      setActionError(null);
      const created = await api.post<{ id: string; number: number }>(
        `/competitions/${activeCompId}/rounds`,
        {
          number: nextNumber,
          name: `Round ${nextNumber}`,
          type: 'OFFICIAL',
          orderType: 'RANDOM',
        },
      );
      await api.post(`/competitions/${activeCompId}/weather/wind`, {
        speedMs: wind.speedMs,
        directionDeg: wind.directionDeg,
        source: 'round-start',
      });
      await api.post(`/competitions/${activeCompId}/rounds/${created.id}/start`);
      return created;
    },
    onSuccess: (round) => {
      setPendingWind(null);
      invalidateRounds();
      if (activeCompId && routeOrgId) {
        setCompetitionId(activeCompId);
        navigate(scorePath(routeOrgId, activeCompId, round.id));
      }
    },
    onError: (err) => {
      setActionError(err instanceof ApiError ? err.message : 'Failed to create round');
    },
  });

  const [pauseTarget, setPauseTarget] = useState<{ id: string; number: number } | null>(null);
  const [pauseReason, setPauseReason] = useState('');

  const pauseMutation = useMutation({
    mutationFn: ({ roundId, reason }: { roundId: string; reason: string }) =>
      api.post(`/competitions/${activeCompId}/rounds/${roundId}/pause`, { reason }),
    onSuccess: () => {
      setPauseTarget(null);
      setPauseReason('');
      invalidateRounds();
    },
    onError: (err) => {
      setActionError(err instanceof ApiError ? err.message : 'Failed to pause round');
    },
  });

  const selectRound = (roundId: string) => {
    if (activeCompId && routeOrgId) {
      setCompetitionId(activeCompId);
      navigate(scorePath(routeOrgId, activeCompId, roundId));
    }
  };

  const busy = startMutation.isPending || createAndStartMutation.isPending || pauseMutation.isPending;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Target className="h-6 w-6 shrink-0 text-sky-400" />
          <div className="min-w-0">
            <p className="font-semibold">Select Round</p>
            <p className="truncate text-sm text-muted-foreground">
              {user?.firstName} {user?.lastName}
              {currentOrganization
                ? ` · ${(currentOrganization.customRoleName ?? currentOrganization.role).replace(/_/g, ' ')}`
                : user?.orgRole
                  ? ` · ${user.orgRole.replace(/_/g, ' ')}`
                  : ''}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {activeOrganizations.length > 1 ? (
            <label className="flex min-w-0 max-w-[14rem] flex-col gap-0.5 sm:max-w-xs">
              <span className="sr-only">Organization</span>
              <select
                className="h-9 max-w-full truncate rounded-md border border-border bg-card px-2 text-sm text-foreground"
                aria-label="Switch organization"
                value={orgId ?? ''}
                onChange={(e) => handleOrganizationChange(e.target.value)}
              >
                {activeOrganizations.map((o) => (
                  <option key={o.organizationId} value={o.organizationId}>
                    {o.shortName} — {o.name}
                  </option>
                ))}
              </select>
            </label>
          ) : currentOrganization ? (
            <span className="hidden max-w-[12rem] truncate text-sm text-muted-foreground sm:inline">
              {currentOrganization.shortName}
            </span>
          ) : null}
          {competitions.length > 1 ? (
            <label className="flex min-w-0 max-w-[14rem] flex-col gap-0.5 sm:max-w-xs">
              <span className="sr-only">Competition</span>
              <select
                className="h-9 max-w-full truncate rounded-md border border-border bg-card px-2 text-sm text-foreground"
                aria-label="Switch competition"
                value={activeCompId ?? ''}
                onChange={(e) => {
                  if (!routeOrgId) return;
                  setPendingWind(null);
                  setActionError(null);
                  setCompetitionId(e.target.value);
                  navigate(roundsPath(routeOrgId, e.target.value));
                }}
              >
                {competitions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {competitionLabel(c)}
                  </option>
                ))}
              </select>
            </label>
          ) : activeCompetition ? (
            <span className="hidden max-w-[12rem] truncate text-sm text-muted-foreground sm:inline">
              {activeCompetition.code}
            </span>
          ) : null}
          <SwitchToAdminButton className="text-muted-foreground hover:text-foreground" />
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl p-6">
        {(compsError || roundsError || actionError) && (
          <p className="mb-4 rounded-lg bg-destructive/20 px-4 py-3 text-sm text-red-300">
            {actionError ||
              (compsError as Error | null)?.message ||
              (roundsError as Error | null)?.message ||
              'Failed to load competition data. Check organization context.'}
          </p>
        )}

        {canCreateNext && roundsNormalized.length > 0 && (
          <div className="mb-6">
            <Button
              className="h-12 w-full text-base font-semibold"
              disabled={busy}
              onClick={() => setPendingWind({ kind: 'create' })}
            >
              <Plus className="mr-2 h-5 w-5" />
              {createAndStartMutation.isPending
                ? `Creating Round ${nextNumber}…`
                : `Create & Start Round ${nextNumber}`}
            </Button>
            {previousRound && COMPLETED_FOR_NEXT.includes(previousRound.status) && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                R{previousRound.number} is {previousRound.status.replace(/_/g, ' ').toLowerCase()} —
                ready for the next round
              </p>
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
        ) : competitions.length === 0 ? (
          <EmptyState
            title="No competition available"
            body={
              competitionsRaw && competitionsRaw.length > 0
                ? 'Every competition in this organization is archived or cancelled.'
                : 'This organization has no competitions yet. Ask the Meet Director or Chief Judge to create one in Admin.'
            }
          />
        ) : !roundsNormalized.length ? (
          <EmptyState
            title="Competition is not started yet"
            body={
              activeCompetition
                ? `“${activeCompetition.name}” has no rounds yet.`
                : 'No rounds have been created.'
            }
          >
            {canCreateNext && (
              <Button
                className="mt-6"
                disabled={busy}
                onClick={() => setPendingWind({ kind: 'create' })}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create & Start Round 1
              </Button>
            )}
          </EmptyState>
        ) : scorableRounds.length === 0 && !canCreateNext ? (
          <EmptyState
            title="No round is open for scoring"
            body={
              atMax
                ? 'All rounds for this competition have been used.'
                : 'Start a scheduled round below, or close the current round before creating the next one.'
            }
          >
            <div className="mt-6 w-full space-y-2 text-left">
              {roundsNormalized.map((round) => (
                <RoundRow
                  key={round.id}
                  round={round}
                  busy={busy}
                  onSelect={selectRound}
                  onStart={(id) => setPendingWind({ kind: 'start', roundId: id })}
                  onResume={(id) => startMutation.mutate({ roundId: id, resume: true })}
                  onPause={(id, number) => {
                    setPauseReason('');
                    setPauseTarget({ id, number });
                  }}
                />
              ))}
            </div>
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {roundsNormalized.map((round) => (
              <RoundRow
                key={round.id}
                round={round}
                busy={busy}
                onSelect={selectRound}
                onStart={(id) => setPendingWind({ kind: 'start', roundId: id })}
                onResume={(id) => startMutation.mutate({ roundId: id, resume: true })}
                onPause={(id, number) => {
                  setPauseReason('');
                  setPauseTarget({ id, number });
                }}
              />
            ))}
          </div>
        )}
      </main>
      <WindSpeedDialog
        open={pendingWind != null}
        title={pendingWind?.kind === 'create' ? `Start round ${nextNumber}` : 'Start round'}
        confirmLabel="Save wind and start"
        initialSpeed={latestWind?.speedMs}
        initialDirection={latestWind?.directionDeg}
        busy={busy}
        error={actionError}
        onClose={() => {
          if (!busy) setPendingWind(null);
        }}
        onConfirm={(wind) => {
          if (pendingWind?.kind === 'create') {
            createAndStartMutation.mutate(wind);
            return;
          }
          if (pendingWind?.kind === 'start') {
            startMutation.mutate({ roundId: pendingWind.roundId, wind });
          }
        }}
      />
      <Dialog
        open={pauseTarget != null}
        onOpenChange={(open) => {
          if (!open) setPauseTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pause round {pauseTarget?.number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="round-select-pause-reason">Reason</Label>
            <Textarea
              id="round-select-pause-reason"
              value={pauseReason}
              onChange={(event) => setPauseReason(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Wind above the limit"
            />
            <p className="text-xs text-muted-foreground">
              Shown on the public pages and the venue display until the round resumes.
            </p>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPauseTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={pauseMutation.isPending || !pauseReason.trim() || !pauseTarget}
              onClick={() => {
                if (!pauseTarget) return;
                pauseMutation.mutate({ roundId: pauseTarget.id, reason: pauseReason.trim() });
              }}
            >
              {pauseMutation.isPending ? 'Pausing…' : 'Pause round'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RoundRow({
  round,
  busy,
  onSelect,
  onStart,
  onResume,
  onPause,
}: {
  round: RoundOption;
  busy: boolean;
  onSelect: (id: string) => void;
  onStart: (id: string) => void;
  onResume: (id: string) => void;
  onPause: (id: string, number: number) => void;
}) {
  const canScore = SCORABLE_STATUSES.includes(round.status);
  const canStart = STARTABLE_STATUSES.includes(round.status);
  const canResume = round.status === 'PAUSED';
  const canPause = round.status === 'ACTIVE';
  const scoringBlocked = ['APPROVED', 'LOCKED', 'CANCELLED', 'SCHEDULED'].includes(round.status);

  return (
    <Card
      className={
        canScore
          ? 'border-border bg-card text-card-foreground transition-colors hover:border-sky-500/50'
          : 'border-border bg-card/60 text-card-foreground opacity-90'
      }
    >
      <CardContent className="flex items-center justify-between gap-3 p-5">
        <button
          type="button"
          className={`min-w-0 flex-1 text-left ${canScore ? 'cursor-pointer' : 'cursor-default'}`}
          onClick={canScore ? () => onSelect(round.id) : undefined}
          disabled={!canScore}
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-2xl font-bold text-sky-400">R{round.number}</span>
            <span className="text-lg font-medium">{round.name || `Round ${round.number}`}</span>
            <Badge variant={statusVariant[round.status]}>{round.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {round.flightsScored ?? 0}/{round.flightsTotal ?? 0} flights scored
            {scoringBlocked && round.status === 'LOCKED' ? ' · Final — scoring closed' : ''}
            {scoringBlocked && round.status === 'APPROVED' ? ' · Approved — scoring closed' : ''}
            {round.status === 'SCHEDULED' ? ' · Not started' : ''}
          </p>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {canStart && (
            <Button
              size="sm"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                onStart(round.id);
              }}
            >
              <Play className="mr-1 h-4 w-4" />
              Start
            </Button>
          )}
          {canPause && (
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                onPause(round.id, round.number);
              }}
            >
              <Pause className="mr-1 h-4 w-4" />
              Pause
            </Button>
          )}
          {canResume && (
            <Button
              size="sm"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                onResume(round.id);
              }}
            >
              <Play className="mr-1 h-4 w-4" />
              Resume
            </Button>
          )}
          {canScore && !canStart ? (
            <ChevronRight className="h-6 w-6 text-muted-foreground" />
          ) : !canStart && !canResume && !canScore ? (
            <span className="text-xs text-muted-foreground">View only</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
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

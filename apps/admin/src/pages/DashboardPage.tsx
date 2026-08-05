import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  Archive,
  ArrowRight,
  CheckCircle2,
  Clock,
  Play,
  Target,
  Trophy,
  Users,
  Wind,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@npha/ui';
import type { CompetitionStatus, RoundStatus } from '@npha/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { onSocketEvent } from '../lib/socket';
import {
  archivedCompetitionsPath,
  competitionPath,
  competitionsListPath,
  useCompetitionId,
  useRouteOrganizationId,
} from '../hooks/useCompetitionId';
import { usePermission } from '../hooks/usePermission';
import { PageHeader } from '../components/PageHeader';

interface DashboardStats {
  status?: CompetitionStatus;
  isPublished?: boolean;
  totalPilots: number;
  totalTeams: number;
  activeRound: { id: string; number: number; name: string; status: RoundStatus } | null;
  roundsCompleted: number;
  roundsTotal: number;
  bullseyesToday: number;
  windSpeedMs: number;
  windDirectionDeg: number;
}

interface CompetitionSummary {
  id: string;
  name: string;
  code: string;
  status: CompetitionStatus;
  isPublished?: boolean;
  venue: string;
  startDate: string;
  endDate: string;
}

const statusVariant: Record<
  CompetitionStatus,
  'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'
> = {
  DRAFT: 'outline',
  REGISTRATION: 'secondary',
  PRACTICE: 'warning',
  OFFICIAL: 'success',
  PAUSED: 'warning',
  COMPLETED: 'default',
  ARCHIVED: 'outline',
  CANCELLED: 'destructive',
};

export function DashboardPage() {
  const competitionId = useCompetitionId();
  const routeOrganizationId = useRouteOrganizationId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, activeOrganizationId } = useAuth();
  const liveStatus = 'Connected';
  const canUpdateCompetition = usePermission('competition:update');
  const orgScope = routeOrganizationId ?? activeOrganizationId ?? user?.organizationId ?? null;

  const { data: competitions } = useQuery({
    queryKey: ['competitions', orgScope ?? 'none'],
    queryFn: () => api.get<CompetitionSummary[]>('/competitions'),
    enabled:
      !!orgScope && (!routeOrganizationId || routeOrganizationId === activeOrganizationId),
  });

  const { data: stats, refetch } = useQuery({
    queryKey: ['dashboard', competitionId],
    queryFn: () => api.get<DashboardStats>(`/competitions/${competitionId}/dashboard`),
    enabled: !!competitionId && !!orgScope,
  });

  const publishMutation = useMutation({
    mutationFn: () => api.post<CompetitionSummary>(`/competitions/${competitionId}/publish`),
    onSuccess: (updated) => {
      queryClient.setQueryData<CompetitionSummary[]>(['competitions', orgScope ?? 'none'], (prev) =>
        prev?.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)),
      );
      queryClient.setQueryData<DashboardStats>(['dashboard', competitionId], (prev) =>
        prev
          ? { ...prev, isPublished: updated.isPublished, status: updated.status }
          : prev,
      );
      queryClient.invalidateQueries({ queryKey: ['competitions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', competitionId] });
      queryClient.invalidateQueries({ queryKey: ['competition', competitionId] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => api.post<CompetitionSummary>(`/competitions/${competitionId}/complete`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', competitionId] });
      queryClient.invalidateQueries({ queryKey: ['rankings'] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => api.post<CompetitionSummary>(`/competitions/${competitionId}/archive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitions'] });
      if (orgScope) {
        navigate(archivedCompetitionsPath(orgScope), { replace: true });
      }
    },
  });

  useEffect(() => {
    if (!competitionId) return;
    const unsubRound = onSocketEvent('round:status', () => refetch());
    const unsubWind = onSocketEvent('wind:updated', () => refetch());
    const unsubScore = onSocketEvent('score:updated', () => refetch());
    const unsubComp = onSocketEvent('competition:status', () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['competitions'] });
    });
    return () => {
      unsubRound();
      unsubWind();
      unsubScore();
      unsubComp();
    };
  }, [competitionId, refetch, queryClient]);

  if (!competitionId || !orgScope) {
    return <Navigate to={orgScope ? competitionsListPath(orgScope) : '/competitions'} replace />;
  }

  const activeCompetition = competitions?.find((c) => c.id === competitionId);
  const displayStatus = stats?.status ?? activeCompetition?.status;
  const displayPublished = stats?.isPublished ?? activeCompetition?.isPublished;
  const needsPublish =
    activeCompetition &&
    (!(displayPublished ?? activeCompetition.isPublished) ||
      (displayStatus ?? activeCompetition.status) === 'DRAFT');
  const canClose =
    canUpdateCompetition &&
    activeCompetition &&
    displayStatus &&
    !['COMPLETED', 'ARCHIVED', 'CANCELLED', 'DRAFT'].includes(displayStatus);
  const canArchive =
    canUpdateCompetition &&
    activeCompetition &&
    displayStatus &&
    !['ARCHIVED', 'DRAFT'].includes(displayStatus);

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Overview"
        description={
          activeCompetition ? (
            <span className="flex flex-col gap-0.5 sm:block">
              <span className="font-medium text-foreground">{activeCompetition.name}</span>
              <span className="sm:before:content-['·_']">{activeCompetition.venue}</span>
            </span>
          ) : (
            'Loading competition…'
          )
        }
        actions={
          <>
            {needsPublish && (
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                disabled={publishMutation.isPending}
                onClick={() => publishMutation.mutate()}
              >
                Publish
              </Button>
            )}
            {canClose && (
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                disabled={completeMutation.isPending}
                onClick={() => {
                  const ok = window.confirm(
                    'Close this competition? Open rounds will be closed and the venue display will show the final podium (1st–3rd). This is typically used when flying stops early (e.g. weather).',
                  );
                  if (ok) completeMutation.mutate();
                }}
              >
                <CheckCircle2 className="mr-2 h-4 w-4 shrink-0" />
                {completeMutation.isPending ? 'Closing…' : 'Close'}
              </Button>
            )}
            {canArchive && (
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                disabled={archiveMutation.isPending}
                onClick={() => {
                  const ok = window.confirm(
                    'Archive this competition? It will be unpublished and hidden from Display and Public Results.',
                  );
                  if (ok) archiveMutation.mutate();
                }}
              >
                <Archive className="mr-2 h-4 w-4 shrink-0" />
                {archiveMutation.isPending ? 'Archiving…' : 'Archive'}
              </Button>
            )}
            <Button variant="outline" asChild className="w-full sm:w-auto">
              <Link to={orgScope && competitionId ? competitionPath(orgScope, competitionId, 'rounds') : '#'}>
                <Play className="mr-2 h-4 w-4 shrink-0" />
                Rounds
              </Link>
            </Button>
            <Button asChild className="w-full sm:w-auto">
              <Link to={orgScope && competitionId ? competitionPath(orgScope, competitionId, 'scoring') : '#'}>
                Enter scores
                <ArrowRight className="ml-2 h-4 w-4 shrink-0" />
              </Link>
            </Button>
          </>
        }
      >
        {activeCompetition && displayStatus && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant={statusVariant[displayStatus]}>{displayStatus}</Badge>
            <Badge variant={displayPublished ? 'success' : 'outline'}>
              {displayPublished ? 'Published' : 'Unpublished'}
            </Badge>
          </div>
        )}
      </PageHeader>

      {competitions && competitions.length > 1 && (
        <div className="max-w-md space-y-1.5">
          <label htmlFor="competition-switch" className="text-xs font-medium text-muted-foreground">
            Switch competition
          </label>
          <Select
            value={competitionId}
            onValueChange={(id) => orgScope ? navigate(competitionPath(orgScope, id)) : undefined}
          >
            <SelectTrigger id="competition-switch" className="w-full">
              <SelectValue placeholder="Select competition" />
            </SelectTrigger>
            <SelectContent>
              {competitions.map((comp) => (
                <SelectItem key={comp.id} value={comp.id}>
                  {comp.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {displayStatus === 'COMPLETED' && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-emerald-700 dark:text-emerald-400">
              <Trophy className="h-5 w-5 shrink-0" />
              Competition completed
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              Final standings are locked for display. Venue boards show the overall podium
              (1st–3rd). You can still generate reports and publish results.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium sm:text-sm">Pilots</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold sm:text-3xl">{stats?.totalPilots ?? '—'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium sm:text-sm">Teams</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold sm:text-3xl">{stats?.totalTeams ?? '—'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium sm:text-sm">Rounds</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold sm:text-3xl">
              {stats ? `${stats.roundsCompleted}/${stats.roundsTotal}` : '—'}
            </div>
            {stats?.activeRound && (
              <p className="mt-1 text-xs text-muted-foreground">
                R{stats.activeRound.number}: {stats.activeRound.status}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium sm:text-sm">Bullseyes</CardTitle>
            <Target className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary sm:text-3xl">
              {stats?.bullseyesToday ?? '—'}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Today</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-5 w-5 shrink-0" />
              Live status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 sm:space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2.5 sm:px-4 sm:py-3">
              <span className="text-sm">Connection</span>
              <Badge variant="success">{liveStatus}</Badge>
            </div>
            {stats?.activeRound && (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2.5 sm:px-4 sm:py-3">
                <span className="text-sm">Active round</span>
                <span className="text-right text-sm font-medium">
                  R{stats.activeRound.number} – {stats.activeRound.name || 'Unnamed'}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2.5 sm:px-4 sm:py-3">
              <span className="flex items-center gap-2 text-sm">
                <Wind className="h-4 w-4 shrink-0" /> Wind
              </span>
              <span className="text-sm font-medium">
                {stats ? `${stats.windSpeedMs} m/s @ ${stats.windDirectionDeg}°` : '—'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick actions</CardTitle>
            <CardDescription>Common operations for this event</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button variant="outline" asChild className="h-11 justify-start sm:h-10">
              <Link to={orgScope && competitionId ? competitionPath(orgScope, competitionId, 'pilots') : '#'}>Register pilots</Link>
            </Button>
            <Button variant="outline" asChild className="h-11 justify-start sm:h-10">
              <Link to={orgScope && competitionId ? competitionPath(orgScope, competitionId, 'teams') : '#'}>Manage teams</Link>
            </Button>
            <Button variant="outline" asChild className="h-11 justify-start sm:h-10">
              <Link to={orgScope && competitionId ? competitionPath(orgScope, competitionId, 'rankings') : '#'}>View rankings</Link>
            </Button>
            <Button variant="outline" asChild className="h-11 justify-start sm:h-10">
              <Link to={orgScope && competitionId ? competitionPath(orgScope, competitionId, 'reports') : '#'}>Generate reports</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

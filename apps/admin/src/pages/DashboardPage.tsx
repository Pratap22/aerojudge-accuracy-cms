import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  Archive,
  ArrowRight,
  CheckCircle2,
  Clock,
  Pencil,
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@aero-judge/ui';
import type { CompetitionStatus, RoundStatus } from '@aero-judge/shared';
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
  const canUpdateWeather = usePermission('weather:update');
  const orgScope = routeOrganizationId ?? activeOrganizationId ?? user?.organizationId ?? null;
  const [windDialogOpen, setWindDialogOpen] = useState(false);
  const [windSpeedMs, setWindSpeedMs] = useState('0');
  const [windDirectionDeg, setWindDirectionDeg] = useState('0');
  const [windGustMs, setWindGustMs] = useState('');
  const [windError, setWindError] = useState<string | null>(null);

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

  const windMutation = useMutation({
    mutationFn: (body: { speedMs: number; directionDeg: number; gustMs?: number }) =>
      api.post(`/competitions/${competitionId}/weather/wind`, {
        ...body,
        source: 'manual',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', competitionId] });
      setWindDialogOpen(false);
      setWindError(null);
      toast({ title: 'Wind updated', description: 'Display boards will refresh live.' });
    },
    onError: (err) => {
      setWindError(err instanceof Error ? err.message : 'Failed to update wind');
    },
  });

  const openWindDialog = () => {
    setWindSpeedMs(String(stats?.windSpeedMs ?? 0));
    setWindDirectionDeg(String(stats?.windDirectionDeg ?? 0));
    setWindGustMs('');
    setWindError(null);
    setWindDialogOpen(true);
  };

  const submitWind = () => {
    const speedMs = Number(windSpeedMs);
    const directionDeg = Number(windDirectionDeg);
    const gustMs = windGustMs.trim() === '' ? undefined : Number(windGustMs);

    if (!Number.isFinite(speedMs) || speedMs < 0) {
      setWindError('Speed must be 0 or greater (m/s).');
      return;
    }
    if (!Number.isFinite(directionDeg) || directionDeg < 0 || directionDeg > 360) {
      setWindError('Direction must be between 0 and 360°.');
      return;
    }
    if (gustMs != null && (!Number.isFinite(gustMs) || gustMs < 0)) {
      setWindError('Gust must be 0 or greater (m/s), or left blank.');
      return;
    }

    setWindError(null);
    windMutation.mutate({
      speedMs,
      directionDeg,
      ...(gustMs != null ? { gustMs } : {}),
    });
  };

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
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {stats ? `${stats.windSpeedMs} m/s @ ${stats.windDirectionDeg}°` : '—'}
                </span>
                {canUpdateWeather && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2"
                    onClick={openWindDialog}
                    disabled={!competitionId}
                  >
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    Update
                  </Button>
                )}
              </div>
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

      <Dialog open={windDialogOpen} onOpenChange={setWindDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update wind</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="wind-speed">Speed (m/s)</Label>
              <Input
                id="wind-speed"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.1"
                value={windSpeedMs}
                onChange={(e) => setWindSpeedMs(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wind-direction">Direction (°)</Label>
              <Input
                id="wind-direction"
                type="number"
                inputMode="numeric"
                min={0}
                max={360}
                step="1"
                value={windDirectionDeg}
                onChange={(e) => setWindDirectionDeg(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">0–360 · meteorological direction wind is from</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wind-gust">Gust (m/s, optional)</Label>
              <Input
                id="wind-gust"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.1"
                value={windGustMs}
                onChange={(e) => setWindGustMs(e.target.value)}
                placeholder="Leave blank if none"
              />
            </div>
            {windError && <p className="text-sm text-destructive">{windError}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setWindDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={submitWind} disabled={windMutation.isPending}>
              {windMutation.isPending ? 'Saving…' : 'Save wind'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

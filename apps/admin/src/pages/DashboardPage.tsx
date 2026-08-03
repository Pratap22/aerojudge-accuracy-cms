import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
} from '@npha/ui';
import type { CompetitionStatus, RoundStatus } from '@npha/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { onSocketEvent } from '../lib/socket';
import { competitionPath, useCompetitionId } from '../hooks/useCompetitionId';
import { usePermission } from '../hooks/usePermission';

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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, activeOrganizationId } = useAuth();
  const liveStatus = 'Connected';
  const canUpdateCompetition = usePermission('competition:update');
  const orgScope = activeOrganizationId ?? user?.organizationId ?? 'none';

  const { data: competitions } = useQuery({
    queryKey: ['competitions', orgScope],
    queryFn: () => api.get<CompetitionSummary[]>('/competitions'),
  });

  const { data: stats, refetch } = useQuery({
    queryKey: ['dashboard', competitionId],
    queryFn: () => api.get<DashboardStats>(`/competitions/${competitionId}/dashboard`),
    enabled: !!competitionId,
  });

  const publishMutation = useMutation({
    mutationFn: () => api.post<CompetitionSummary>(`/competitions/${competitionId}/publish`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competitions'] });
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
      navigate('/competitions/archived', { replace: true });
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

  if (!competitionId) {
    return <Navigate to="/competitions" replace />;
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Competition Overview</h1>
          <p className="text-muted-foreground">
            {activeCompetition
              ? `${activeCompetition.name} · ${activeCompetition.venue}`
              : 'Loading competition…'}
          </p>
          {activeCompetition && displayStatus && (
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant={statusVariant[displayStatus]}>
                {displayStatus}
              </Badge>
              <Badge variant={displayPublished ? 'success' : 'outline'}>
                {displayPublished ? 'Published' : 'Unpublished'}
              </Badge>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {needsPublish && (
            <Button
              variant="secondary"
              disabled={publishMutation.isPending}
              onClick={() => publishMutation.mutate()}
            >
              Publish competition
            </Button>
          )}
          {canClose && (
            <Button
              variant="outline"
              disabled={completeMutation.isPending}
              onClick={() => {
                const ok = window.confirm(
                  'Close this competition? Open rounds will be closed and the venue display will show the final podium (1st–3rd). This is typically used when flying stops early (e.g. weather).',
                );
                if (ok) completeMutation.mutate();
              }}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {completeMutation.isPending ? 'Closing…' : 'Close competition'}
            </Button>
          )}
          {canArchive && (
            <Button
              variant="outline"
              disabled={archiveMutation.isPending}
              onClick={() => {
                const ok = window.confirm(
                  'Archive this competition? It will be unpublished and hidden from Display and Public Results.',
                );
                if (ok) archiveMutation.mutate();
              }}
            >
              <Archive className="mr-2 h-4 w-4" />
              {archiveMutation.isPending ? 'Archiving…' : 'Archive'}
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link to={competitionPath(competitionId, 'rounds')}>
              <Play className="mr-2 h-4 w-4" />
              Manage Rounds
            </Link>
          </Button>
          <Button asChild>
            <Link to={competitionPath(competitionId, 'scoring')}>
              Enter Scores
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {displayStatus === 'COMPLETED' && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-emerald-700 dark:text-emerald-400">
              <Trophy className="h-5 w-5" />
              Competition completed
            </CardTitle>
            <CardDescription>
              Final standings are locked for display. Venue boards show the overall podium
              (1st–3rd). You can still generate reports and publish results.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {competitions && competitions.length > 1 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {competitions.map((comp, i) => (
            <motion.div
              key={comp.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link to={competitionPath(comp.id)}>
                <Card
                  className={`transition-shadow hover:shadow-md ${comp.id === competitionId ? 'ring-2 ring-primary' : ''}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <Trophy className="h-5 w-5 text-primary" />
                      <Badge variant={statusVariant[comp.status]}>{comp.status}</Badge>
                    </div>
                    <CardTitle className="text-base">{comp.name}</CardTitle>
                    <CardDescription>{comp.code}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{comp.venue}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(comp.startDate).toLocaleDateString()} –{' '}
                      {new Date(comp.endDate).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Registered Pilots</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.totalPilots ?? '—'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Teams</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.totalTeams ?? '—'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Round Progress</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats ? `${stats.roundsCompleted}/${stats.roundsTotal}` : '—'}
            </div>
            {stats?.activeRound && (
              <p className="text-xs text-muted-foreground">
                Round {stats.activeRound.number}: {stats.activeRound.status}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Bullseyes Today</CardTitle>
            <Target className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{stats?.bullseyesToday ?? '—'}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Live Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
              <span className="text-sm">Socket connection</span>
              <Badge variant="success">{liveStatus}</Badge>
            </div>
            {stats?.activeRound && (
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                <span className="text-sm">Active round</span>
                <span className="font-medium">
                  R{stats.activeRound.number} – {stats.activeRound.name || 'Unnamed'}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
              <span className="flex items-center gap-2 text-sm">
                <Wind className="h-4 w-4" /> Wind
              </span>
              <span className="font-medium">
                {stats ? `${stats.windSpeedMs} m/s @ ${stats.windDirectionDeg}°` : '—'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common competition operations</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" asChild className="justify-start">
              <Link to={competitionPath(competitionId, 'pilots')}>Register pilots</Link>
            </Button>
            <Button variant="outline" asChild className="justify-start">
              <Link to={competitionPath(competitionId, 'teams')}>Manage teams</Link>
            </Button>
            <Button variant="outline" asChild className="justify-start">
              <Link to={competitionPath(competitionId, 'rankings')}>View rankings</Link>
            </Button>
            <Button variant="outline" asChild className="justify-start">
              <Link to={competitionPath(competitionId, 'reports')}>Generate reports</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
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
import { useEffect } from 'react';

interface DashboardStats {
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
  venue: string;
  startDate: string;
  endDate: string;
}

const statusVariant: Record<CompetitionStatus, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
  DRAFT: 'outline' as 'default',
  REGISTRATION: 'secondary',
  PRACTICE: 'warning',
  OFFICIAL: 'success',
  PAUSED: 'warning',
  COMPLETED: 'default',
  ARCHIVED: 'outline' as 'default',
  CANCELLED: 'destructive',
};

export function DashboardPage() {
  const { activeCompetitionId, setActiveCompetitionId } = useAuth();
  const liveStatus = 'Connected';

  const { data: competitions } = useQuery({
    queryKey: ['competitions'],
    queryFn: () => api.get<CompetitionSummary[]>('/competitions'),
  });

  const { data: stats, refetch } = useQuery({
    queryKey: ['dashboard', activeCompetitionId],
    queryFn: () => api.get<DashboardStats>(`/competitions/${activeCompetitionId}/dashboard`),
    enabled: !!activeCompetitionId,
  });

  useEffect(() => {
    if (!activeCompetitionId) return;
    const unsubRound = onSocketEvent('round:status', () => refetch());
    const unsubWind = onSocketEvent('wind:updated', () => refetch());
    const unsubScore = onSocketEvent('score:updated', () => refetch());
    return () => {
      unsubRound();
      unsubWind();
      unsubScore();
    };
  }, [activeCompetitionId, refetch]);

  const activeCompetition = competitions?.find((c) => c.id === activeCompetitionId) ?? competitions?.[0];

  useEffect(() => {
    if (!activeCompetitionId && activeCompetition) {
      setActiveCompetitionId(activeCompetition.id);
    }
  }, [activeCompetition, activeCompetitionId, setActiveCompetitionId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Competition Overview</h1>
          <p className="text-muted-foreground">
            {activeCompetition ? `${activeCompetition.name} · ${activeCompetition.venue}` : 'Select a competition to begin'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/rounds">
              <Play className="mr-2 h-4 w-4" />
              Manage Rounds
            </Link>
          </Button>
          <Button asChild>
            <Link to="/scoring">
              Enter Scores
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {competitions && competitions.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {competitions.map((comp, i) => (
            <motion.div
              key={comp.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card
                className={`cursor-pointer transition-shadow hover:shadow-md ${comp.id === activeCompetitionId ? 'ring-2 ring-secondary' : ''}`}
                onClick={() => setActiveCompetitionId(comp.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <Trophy className="h-5 w-5 text-secondary" />
                    <Badge variant={statusVariant[comp.status]}>{comp.status}</Badge>
                  </div>
                  <CardTitle className="text-base">{comp.name}</CardTitle>
                  <CardDescription>{comp.code}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{comp.venue}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(comp.startDate).toLocaleDateString()} – {new Date(comp.endDate).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
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
            <Target className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-secondary">{stats?.bullseyesToday ?? '—'}</div>
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
              <Link to="/pilots">Register pilots</Link>
            </Button>
            <Button variant="outline" asChild className="justify-start">
              <Link to="/teams">Manage teams</Link>
            </Button>
            <Button variant="outline" asChild className="justify-start">
              <Link to="/rankings">View rankings</Link>
            </Button>
            <Button variant="outline" asChild className="justify-start">
              <Link to="/reports">Generate reports</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { BarChart3, Target, TrendingUp, Trophy } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@npha/ui';
import { api } from '../lib/api';
import { useCompetitionId } from '../hooks/useCompetitionId';

interface CompetitionStats {
  totalFlights: number;
  totalBullseyes: number;
  bullseyeRate: number;
  averageScoreCm: number;
  bestSingleScore: { pilotName: string; scoreCm: number; round: number };
  topPilots: { rank: number; pilotName: string; bullseyes: number; avgScoreCm: number }[];
  roundAverages: { round: number; avgScoreCm: number; bullseyes: number }[];
}

export function StatisticsPage() {
  const activeCompetitionId = useCompetitionId();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['statistics', activeCompetitionId],
    queryFn: () => api.get<CompetitionStats>(`/competitions/${activeCompetitionId}/statistics`),
    enabled: !!activeCompetitionId,
  });

  if (!activeCompetitionId) {
    return <p className="text-muted-foreground"><a href="/competitions" className="text-secondary underline">Open a competition</a> from the Competitions list.</p>;
  }

  if (isLoading) {
    return <p className="text-muted-foreground">Loading statistics…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Statistics</h1>
        <p className="text-muted-foreground">Competition performance analytics</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Bullseyes</CardTitle>
            <Target className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-secondary">{stats?.totalBullseyes ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats ? `${(stats.bullseyeRate * 100).toFixed(1)}% of flights` : ''}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.averageScoreCm.toFixed(1) ?? '—'} cm</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Best Single Score</CardTitle>
            <Trophy className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.bestSingleScore.scoreCm ?? '—'} cm</div>
            <p className="text-xs text-muted-foreground">
              {stats?.bestSingleScore.pilotName} · R{stats?.bestSingleScore.round}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Flights</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats?.totalFlights ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Best Pilots</CardTitle>
            <CardDescription>Top performers by bullseyes and average score</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Pilot</TableHead>
                  <TableHead className="text-right">Bullseyes</TableHead>
                  <TableHead className="text-right">Avg (cm)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats?.topPilots.map((p) => (
                  <TableRow key={p.rank}>
                    <TableCell>{p.rank}</TableCell>
                    <TableCell className="font-medium">{p.pilotName}</TableCell>
                    <TableCell className="text-right">{p.bullseyes}</TableCell>
                    <TableCell className="text-right font-mono">{p.avgScoreCm.toFixed(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Round Averages</CardTitle>
            <CardDescription>Score trends across rounds</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Round</TableHead>
                  <TableHead className="text-right">Avg Score (cm)</TableHead>
                  <TableHead className="text-right">Bullseyes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats?.roundAverages.map((r) => (
                  <TableRow key={r.round}>
                    <TableCell>R{r.round}</TableCell>
                    <TableCell className="text-right font-mono">{r.avgScoreCm.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{r.bullseyes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

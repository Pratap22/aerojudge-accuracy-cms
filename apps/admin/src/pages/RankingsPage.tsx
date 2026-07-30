import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Medal } from 'lucide-react';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@npha/ui';
import type { IndividualRankingResult, RankingCategory, TeamRankingResult } from '@npha/shared';
import { api } from '../lib/api';
import { useCompetitionId } from '../hooks/useCompetitionId';
import { connectSocket, onSocketEvent } from '../lib/socket';

const categories: { value: RankingCategory; label: string }[] = [
  { value: 'OVERALL', label: 'Overall' },
  { value: 'WOMEN', label: 'Women' },
  { value: 'JUNIOR', label: 'Junior' },
  { value: 'TEAM', label: 'Teams' },
  { value: 'COUNTRY', label: 'Country' },
];

interface RankingRow {
  rank: number;
  id: string;
  name: string;
  country?: string;
  totalScoreCm: number;
  roundsFlown: number;
  bullseyes: number;
}

function mapIndividual(rows: IndividualRankingResult[], pilots: Record<string, string>): RankingRow[] {
  return rows.map((r) => ({
    rank: r.rank,
    id: r.pilotId,
    name: pilots[r.pilotId] ?? r.pilotId,
    totalScoreCm: r.totalScoreCm,
    roundsFlown: r.roundsFlown,
    bullseyes: r.bullseyes,
  }));
}

function mapTeam(rows: TeamRankingResult[], teams: Record<string, string>): RankingRow[] {
  return rows.map((r) => ({
    rank: r.rank,
    id: r.teamId,
    name: teams[r.teamId] ?? r.teamId,
    totalScoreCm: r.totalScoreCm,
    roundsFlown: r.roundsScored,
    bullseyes: 0,
  }));
}

export function RankingsPage() {
  const activeCompetitionId = useCompetitionId();
  const [category, setCategory] = useState<RankingCategory>('OVERALL');
  const [liveUpdate, setLiveUpdate] = useState<Date | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (activeCompetitionId) connectSocket(activeCompetitionId);
  }, [activeCompetitionId]);

  useEffect(() => {
    if (!activeCompetitionId) return;
    const unsub = onSocketEvent('ranking:updated', (payload) => {
      if (payload.category === category || payload.category === 'OVERALL') {
        setLiveUpdate(new Date());
        queryClient.invalidateQueries({ queryKey: ['rankings', activeCompetitionId] });
      }
    });
    return unsub;
  }, [activeCompetitionId, category, queryClient]);

  const { data, isLoading } = useQuery({
    queryKey: ['rankings', activeCompetitionId, category],
    queryFn: async () => {
      if (category === 'TEAM') {
        const [rankings, teams] = await Promise.all([
          api.get<TeamRankingResult[]>(`/competitions/${activeCompetitionId}/rankings/team`),
          api.get<{ id: string; name: string }[]>(`/competitions/${activeCompetitionId}/teams`),
        ]);
        const teamMap = Object.fromEntries(teams.map((t) => [t.id, t.name]));
        return mapTeam(rankings, teamMap);
      }
      const [rankings, pilots] = await Promise.all([
        api.get<IndividualRankingResult[]>(
          `/competitions/${activeCompetitionId}/rankings/${category.toLowerCase()}`,
        ),
        api.get<{ id: string; firstName: string; lastName: string; pilotNumber: number }[]>(
          `/competitions/${activeCompetitionId}/pilots`,
        ),
      ]);
      const pilotMap = Object.fromEntries(
        pilots.map((p) => [p.id, `#${p.pilotNumber} ${p.firstName} ${p.lastName}`]),
      );
      return mapIndividual(rankings, pilotMap);
    },
    enabled: !!activeCompetitionId,
    refetchInterval: 60_000,
  });

  if (!activeCompetitionId) {
    return <p className="text-muted-foreground"><a href="/competitions" className="text-secondary underline">Open a competition</a> from the Competitions list.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rankings</h1>
          <p className="text-muted-foreground">Live standings with FAI tie-break rules</p>
        </div>
        {liveUpdate && (
          <Badge variant="success" className="animate-pulse">
            Updated {liveUpdate.toLocaleTimeString()}
          </Badge>
        )}
      </div>

      <Tabs value={category} onValueChange={(v) => setCategory(v as RankingCategory)}>
        <TabsList>
          {categories.map((c) => (
            <TabsTrigger key={c.value} value={c.value}>
              {c.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map((c) => (
          <TabsContent key={c.value} value={c.value}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Medal className="h-5 w-5 text-secondary" />
                  {c.label} Rankings
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>{category === 'TEAM' ? 'Team' : 'Pilot'}</TableHead>
                      {category === 'COUNTRY' && <TableHead>Country</TableHead>}
                      <TableHead className="text-right">Total (cm)</TableHead>
                      <TableHead className="text-right">Rounds</TableHead>
                      {category !== 'TEAM' && <TableHead className="text-right">Bullseyes</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          Loading…
                        </TableCell>
                      </TableRow>
                    ) : data?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          No rankings available yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data?.map((row) => (
                        <TableRow key={row.id} className={row.rank <= 3 ? 'bg-secondary/5' : ''}>
                          <TableCell>
                            <span
                              className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                                row.rank === 1
                                  ? 'bg-amber-400 text-amber-950'
                                  : row.rank === 2
                                    ? 'bg-slate-300 text-slate-800'
                                    : row.rank === 3
                                      ? 'bg-amber-700 text-amber-100'
                                      : 'bg-muted'
                              }`}
                            >
                              {row.rank}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          {category === 'COUNTRY' && <TableCell>{row.country ?? '—'}</TableCell>}
                          <TableCell className="text-right font-mono">{row.totalScoreCm.toFixed(1)}</TableCell>
                          <TableCell className="text-right">{row.roundsFlown}</TableCell>
                          {category !== 'TEAM' && (
                            <TableCell className="text-right">{row.bullseyes}</TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

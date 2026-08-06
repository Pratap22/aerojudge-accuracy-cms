import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatScoreCm } from '@npha/utils';
import { Medal, RefreshCw } from 'lucide-react';
import {
  Badge,
  Button,
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
import type { RankingCategory } from '@npha/shared';
import { api, ApiError } from '../lib/api';
import { useCompetitionId } from '../hooks/useCompetitionId';
import { connectSocket, onSocketEvent } from '../lib/socket';

const allCategories: { value: RankingCategory; label: string }[] = [
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

interface IndividualRankingApi {
  rank: number;
  pilotId: string;
  totalScoreCm: number;
  roundsFlown: number;
  bullseyes: number;
  pilot?: {
    id: string;
    pilotNumber: number;
    firstName: string;
    lastName: string;
    country?: { name?: string; code?: string } | null;
  };
}

interface TeamRankingApi {
  rank: number;
  teamId: string;
  totalScoreCm: number;
  roundsScored: number;
  team?: { id: string; name: string; country?: { name?: string } | null };
}

interface CountryRankingApi {
  rank: number;
  countryId: string;
  totalScoreCm: number;
  pilotIds?: string[];
}

function mapIndividual(rows: IndividualRankingApi[]): RankingRow[] {
  return rows
    .filter((r) => r.roundsFlown > 0)
    .map((r) => ({
      rank: r.rank,
      id: r.pilotId,
      name: r.pilot
        ? `#${r.pilot.pilotNumber} ${r.pilot.firstName} ${r.pilot.lastName}`
        : r.pilotId,
      country: r.pilot?.country?.name ?? r.pilot?.country?.code,
      totalScoreCm: r.totalScoreCm,
      roundsFlown: r.roundsFlown,
      bullseyes: r.bullseyes,
    }));
}

function mapTeam(rows: TeamRankingApi[]): RankingRow[] {
  return rows.map((r) => ({
    rank: r.rank,
    id: r.teamId,
    name: r.team?.name ?? r.teamId,
    country: r.team?.country?.name,
    totalScoreCm: r.totalScoreCm,
    roundsFlown: r.roundsScored,
    bullseyes: 0,
  }));
}

function mapCountry(
  rows: CountryRankingApi[],
  countryNames: Record<string, string>,
): RankingRow[] {
  return rows.map((r) => ({
    rank: r.rank,
    id: r.countryId,
    name: countryNames[r.countryId] ?? r.countryId,
    country: countryNames[r.countryId] ?? r.countryId,
    totalScoreCm: r.totalScoreCm,
    roundsFlown: r.pilotIds?.length ?? 0,
    bullseyes: 0,
  }));
}

export function RankingsPage() {
  const activeCompetitionId = useCompetitionId();
  const [category, setCategory] = useState<RankingCategory>('OVERALL');
  const [liveUpdate, setLiveUpdate] = useState<Date | null>(null);
  const queryClient = useQueryClient();

  const { data: teams } = useQuery({
    queryKey: ['teams', activeCompetitionId],
    queryFn: () =>
      api.get<{ id: string }[]>(`/competitions/${activeCompetitionId}/teams`, { pageSize: 1 }),
    enabled: !!activeCompetitionId,
  });
  const hasTeams = (teams?.length ?? 0) > 0;
  const categories = hasTeams
    ? allCategories
    : allCategories.filter((c) => c.value !== 'TEAM');

  useEffect(() => {
    if (category === 'TEAM' && !hasTeams) setCategory('OVERALL');
  }, [category, hasTeams]);

  useEffect(() => {
    if (activeCompetitionId) connectSocket(activeCompetitionId);
  }, [activeCompetitionId]);

  useEffect(() => {
    if (!activeCompetitionId) return;
    const unsub = onSocketEvent('ranking:updated', () => {
      setLiveUpdate(new Date());
      void queryClient.invalidateQueries({ queryKey: ['rankings', activeCompetitionId] });
    });
    return unsub;
  }, [activeCompetitionId, queryClient]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['rankings', activeCompetitionId, category],
    queryFn: async () => {
      const base = `/competitions/${activeCompetitionId}/rankings`;

      if (category === 'TEAM') {
        const rankings = await api.get<TeamRankingApi[]>(`${base}/team`);
        return mapTeam(rankings);
      }

      if (category === 'COUNTRY') {
        const [rankings, pilots] = await Promise.all([
          api.get<CountryRankingApi[]>(`${base}/country`),
          api.get<
            {
              id: string;
              countryId?: string | null;
              country?: { id: string; name: string; code: string } | null;
            }[]
          >(`/competitions/${activeCompetitionId}/pilots`, { pageSize: 500 }),
        ]);
        const countryNames: Record<string, string> = {};
        for (const p of pilots) {
          if (p.countryId && p.country) {
            countryNames[p.countryId] = p.country.name;
          }
        }
        return mapCountry(rankings, countryNames);
      }

      const path =
        category === 'OVERALL'
          ? `${base}/overall`
          : category === 'WOMEN'
            ? `${base}/women`
            : `${base}/junior`;
      const rankings = await api.get<IndividualRankingApi[]>(path);
      return mapIndividual(rankings);
    },
    enabled: !!activeCompetitionId,
    refetchInterval: 30_000,
  });

  const recalcMutation = useMutation({
    mutationFn: () =>
      api.post(`/competitions/${activeCompetitionId}/rankings/recalculate`),
    onSuccess: () => {
      setLiveUpdate(new Date());
      void queryClient.invalidateQueries({ queryKey: ['rankings', activeCompetitionId] });
    },
  });

  if (!activeCompetitionId) {
    return (
      <p className="text-muted-foreground">
        <Link to="/competitions" className="text-primary underline">
          Open a competition
        </Link>{' '}
        from the Competitions list.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Rankings</h1>
          <p className="text-muted-foreground">Live standings with FAI tie-break rules · Approved/Locked official rounds only</p>
        </div>
        <div className="flex items-center gap-2">
          {liveUpdate && (
            <Badge variant="success" className="animate-pulse">
              Updated {liveUpdate.toLocaleTimeString()}
            </Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={recalcMutation.isPending}
            onClick={() => recalcMutation.mutate()}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${recalcMutation.isPending ? 'animate-spin' : ''}`} />
            Recalculate
          </Button>
        </div>
      </div>

      {recalcMutation.isError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {recalcMutation.error instanceof ApiError
            ? recalcMutation.error.message
            : 'Failed to recalculate rankings'}
        </div>
      )}

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
                  <Medal className="h-5 w-5 text-primary" />
                  {c.label} Rankings
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>{category === 'TEAM' ? 'Team' : category === 'COUNTRY' ? 'Country' : 'Pilot'}</TableHead>
                      <TableHead className="text-right">Total (cm)</TableHead>
                      <TableHead className="text-right">
                        {category === 'COUNTRY' ? 'Pilots' : 'Rounds'}
                      </TableHead>
                      {category !== 'TEAM' && category !== 'COUNTRY' && (
                        <TableHead className="text-right">Bullseyes</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Loading…
                        </TableCell>
                      </TableRow>
                    ) : isError ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-destructive">
                          {error instanceof ApiError ? error.message : 'Failed to load rankings'}{' '}
                          <button type="button" className="underline" onClick={() => void refetch()}>
                            Retry
                          </button>
                        </TableCell>
                      </TableRow>
                    ) : !data?.length ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No rankings available yet. Enter scores, then click Recalculate.
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.map((row) => (
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
                          <TableCell className="text-right font-mono">
                            {formatScoreCm(Number(row.totalScoreCm))}
                          </TableCell>
                          <TableCell className="text-right">{row.roundsFlown}</TableCell>
                          {category !== 'TEAM' && category !== 'COUNTRY' && (
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

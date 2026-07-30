import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { enterScoreSchema, type EnterScoreInput, type ScoreResultType } from '@npha/shared';
import { Save, Target } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from '@npha/ui';
import { api, ApiError } from '../lib/api';
import { useCompetitionId } from '../hooks/useCompetitionId';
import { competitionPath } from '../hooks/useCompetitionId';
import { Link } from 'react-router-dom';

interface RoundOption {
  id: string;
  number: number;
  name: string;
  status: string;
}

interface Flight {
  id: string;
  order: number;
  pilotNumber: number;
  pilotName: string;
  country: string;
  status: string;
  distanceCm: number | null;
  resultType: ScoreResultType | null;
}

export function ScoringPage() {
  const activeCompetitionId = useCompetitionId();
  const [selectedRoundId, setSelectedRoundId] = useState<string>('');
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: rounds } = useQuery({
    queryKey: ['rounds', activeCompetitionId],
    queryFn: () => api.get<RoundOption[]>(`/competitions/${activeCompetitionId}/rounds`),
    enabled: !!activeCompetitionId,
  });

  const { data: flights } = useQuery({
    queryKey: ['flights', activeCompetitionId, selectedRoundId],
    queryFn: () =>
      api.get<Flight[]>(`/competitions/${activeCompetitionId}/rounds/${selectedRoundId}/flights`),
    enabled: !!activeCompetitionId && !!selectedRoundId,
  });

  const selectedFlight = flights?.find((f) => f.id === selectedFlightId);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EnterScoreInput>({
    resolver: zodResolver(enterScoreSchema),
    defaultValues: { flightId: '', distanceCm: null, resultType: 'MEASURED', penaltyCm: 0 },
  });

  const resultType = watch('resultType');

  const scoreMutation = useMutation({
    mutationFn: (data: EnterScoreInput) =>
      api.post(`/competitions/${activeCompetitionId}/rounds/${selectedRoundId}/scores`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flights'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['rankings'] });
      queryClient.invalidateQueries({ queryKey: ['rounds'] });
      reset({ flightId: selectedFlightId ?? '', distanceCm: null, resultType: 'MEASURED', penaltyCm: 0 });
    },
  });

  useEffect(() => {
    if (!rounds?.length || selectedRoundId) return;
    const preferred =
      rounds.find((r) => ['ACTIVE', 'OPEN', 'PAUSED'].includes(r.status)) ?? rounds[0];
    if (preferred) setSelectedRoundId(preferred.id);
  }, [rounds, selectedRoundId]);

  const reopenMutation = useMutation({
    mutationFn: () =>
      api.post(`/competitions/${activeCompetitionId}/rounds/${selectedRoundId}/reopen`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rounds'] }),
  });

  const selectedRound = rounds?.find((r) => r.id === selectedRoundId);

  const selectFlight = (flight: Flight) => {
    setSelectedFlightId(flight.id);
    reset({
      flightId: flight.id,
      distanceCm: flight.distanceCm,
      resultType: flight.resultType ?? 'MEASURED',
      penaltyCm: 0,
    });
  };

  const quickResult = (type: ScoreResultType, distance: number | null = null) => {
    if (!selectedFlightId) return;
    setValue('resultType', type);
    setValue('distanceCm', distance);
  };

  if (!activeCompetitionId) {
    return <p className="text-muted-foreground"><a href="/competitions" className="text-secondary underline">Open a competition</a> from the Competitions list.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Scoring</h1>
        <p className="text-muted-foreground">Enter and confirm flight scores by round</p>
      </div>

      <div className="max-w-xs space-y-2">
        <Label>Select Round</Label>
        <Select
          value={selectedRoundId}
          onValueChange={(v) => {
            setSelectedRoundId(v);
            setSelectedFlightId(null);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Choose round…" />
          </SelectTrigger>
          <SelectContent>
            {rounds?.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                R{r.number} {r.name} ({r.status})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedRoundId && (
        <div className="space-y-4">
          {selectedRound && ['CLOSED', 'PENDING_APPROVAL'].includes(selectedRound.status) && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
              <p>
                Round is <strong>{selectedRound.status}</strong>. You can still enter or correct
                scores until it is approved/locked, or reopen it for live flying.
              </p>
              <Button
                size="sm"
                variant="outline"
                disabled={reopenMutation.isPending}
                onClick={() => reopenMutation.mutate()}
              >
                Reopen Round
              </Button>
            </div>
          )}

          {!flights?.length && (
            <div className="rounded-lg border px-4 py-3 text-sm text-muted-foreground">
              No flights in this round yet.{' '}
              <Link
                className="text-secondary underline"
                to={competitionPath(activeCompetitionId, 'rounds')}
              >
                Open Rounds
              </Link>{' '}
              and start the round (or regenerate flight order) after registering pilots.
            </div>
          )}

          {scoreMutation.isError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {scoreMutation.error instanceof ApiError
                ? scoreMutation.error.message
                : 'Failed to save score'}
            </div>
          )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>#</TableHead>
                  <TableHead>Pilot</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flights?.map((flight) => (
                  <TableRow
                    key={flight.id}
                    className={flight.id === selectedFlightId ? 'bg-secondary/10' : 'cursor-pointer'}
                    onClick={() => selectFlight(flight)}
                  >
                    <TableCell>{flight.order}</TableCell>
                    <TableCell className="font-mono">{flight.pilotNumber}</TableCell>
                    <TableCell>{flight.pilotName}</TableCell>
                    <TableCell>{flight.country}</TableCell>
                    <TableCell>
                      {flight.resultType === 'BULLSEYE' ? (
                        <Badge variant="success">Bullseye</Badge>
                      ) : flight.distanceCm != null ? (
                        `${flight.distanceCm} cm`
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{flight.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Enter Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedFlight ? (
                <form onSubmit={handleSubmit((d) => scoreMutation.mutate(d))} className="space-y-4">
                  <div className="rounded-lg bg-muted/50 p-3 text-sm">
                    <p className="font-medium">
                      #{selectedFlight.pilotNumber} {selectedFlight.pilotName}
                    </p>
                    <p className="text-muted-foreground">{selectedFlight.country}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ['BULLSEYE', 'Bullseye', 0],
                        ['DNF', 'DNF', null],
                        ['ABS', 'ABS', null],
                        ['DNS', 'DNS', null],
                        ['REFLIGHT', 'Reflight', null],
                        ['MAXIMUM', 'Maximum', 1000],
                      ] as const
                    ).map(([type, label, dist]) => (
                      <Button
                        key={type}
                        type="button"
                        size="sm"
                        variant={resultType === type ? 'default' : 'outline'}
                        onClick={() => quickResult(type, dist)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <Label>Distance (cm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      {...register('distanceCm', {
                        setValueAs: (v) => (v === '' || v == null ? null : Number(v)),
                      })}
                    />
                    {errors.distanceCm && (
                      <p className="text-sm text-destructive">{errors.distanceCm.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Result Type</Label>
                    <Select
                      value={resultType}
                      onValueChange={(v) => setValue('resultType', v as ScoreResultType)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MEASURED">Measured</SelectItem>
                        <SelectItem value="BULLSEYE">Bullseye</SelectItem>
                        <SelectItem value="MAXIMUM">Maximum</SelectItem>
                        <SelectItem value="DNF">DNF</SelectItem>
                        <SelectItem value="ABS">ABS</SelectItem>
                        <SelectItem value="DNS">DNS</SelectItem>
                        <SelectItem value="REFLIGHT">Reflight</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Judge Notes</Label>
                    <Textarea {...register('judgeNotes')} rows={2} />
                  </div>

                  <input type="hidden" {...register('flightId')} />

                  <Button type="submit" className="w-full" disabled={scoreMutation.isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    Save Score
                  </Button>
                </form>
              ) : (
                <p className="text-sm text-muted-foreground">Select a flight from the list to enter a score.</p>
              )}
            </CardContent>
          </Card>
        </div>
        </div>
      )}
    </div>
  );
}

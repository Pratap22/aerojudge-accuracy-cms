import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { enterScoreSchema, type EnterScoreInput, type ScoreResultType, type RuleConfig } from '@aero-judge/shared';
import { formatScoreCm } from '@aero-judge/utils';
import { Pause, Play, Save, Target, Wind } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  toast,
} from '@aero-judge/ui';
import { api, ApiError } from '../lib/api';
import { competitionPath, competitionsListPath, useCompetitionId, useRouteOrganizationId } from '../hooks/useCompetitionId';
import { usePermission } from '../hooks/usePermission';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { onSocketEvent } from '../lib/socket';

interface RoundOption {
  id: string;
  number: number;
  name: string;
  status: string;
  pauseReason?: string | null;
}

interface LatestWind {
  speedMs: number;
  directionDeg: number;
  gustMs?: number | null;
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
  finalScoreCm?: number | null;
}

function formatFlightScore(flight: Flight): ReactNode {
  const type = flight.resultType;

  if (type === 'BULLSEYE' || (flight.distanceCm === 0 && type === 'MEASURED')) {
    return <Badge variant="success">Bullseye</Badge>;
  }

  if (type && type !== 'MEASURED') {
    const variant =
      type === 'DNF' || type === 'ABS' || type === 'DNS' || type === 'DSQ'
        ? 'destructive'
        : type === 'REFLIGHT'
          ? 'warning'
          : 'secondary';
    return <Badge variant={variant}>{type}</Badge>;
  }

  if (flight.distanceCm != null) {
    return `${formatScoreCm(flight.distanceCm)} cm`;
  }

  if (flight.finalScoreCm != null && flight.status === 'SCORED') {
    return `${formatScoreCm(flight.finalScoreCm)} cm`;
  }

  return '—';
}

export function ScoringPage() {
  const activeCompetitionId = useCompetitionId();
  const routeOrganizationId = useRouteOrganizationId();
  const { activeOrganizationId, user } = useAuth();
  const canUpdateWeather = usePermission('weather:update');
  const canManageRounds = usePermission('round:manage');
  const orgId = routeOrganizationId ?? activeOrganizationId ?? user?.organizationId ?? null;
  const competitionsHref = orgId ? competitionsListPath(orgId) : '/competitions';
  const [selectedRoundId, setSelectedRoundId] = useState<string>('');
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [windDialogOpen, setWindDialogOpen] = useState(false);
  const [windSpeedMs, setWindSpeedMs] = useState('');
  const [windDirectionDeg, setWindDirectionDeg] = useState('');
  const [windGustMs, setWindGustMs] = useState('');
  const [windError, setWindError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: rounds } = useQuery({
    queryKey: ['rounds', activeCompetitionId],
    queryFn: () => api.get<RoundOption[]>(`/competitions/${activeCompetitionId}/rounds`),
    enabled: !!activeCompetitionId,
  });

  const { data: rules } = useQuery({
    queryKey: ['settings', activeCompetitionId],
    queryFn: () => api.get<RuleConfig>(`/competitions/${activeCompetitionId}/rules`),
    enabled: !!activeCompetitionId,
  });

  const maximumScoreCm = rules?.maximumScoreCm ?? 1000;

  const { data: latestWind } = useQuery({
    queryKey: ['wind', activeCompetitionId],
    queryFn: () =>
      api.get<LatestWind | null>(`/competitions/${activeCompetitionId}/weather/wind/latest`),
    enabled: !!activeCompetitionId,
  });

  useEffect(() => {
    if (!activeCompetitionId) return;
    return onSocketEvent('wind:updated', (payload) => {
      if (payload.competitionId !== activeCompetitionId) return;
      queryClient.setQueryData<LatestWind>(['wind', activeCompetitionId], (prev) => ({
        speedMs: payload.speedMs,
        directionDeg: payload.directionDeg,
        gustMs: prev?.gustMs ?? null,
      }));
    });
  }, [activeCompetitionId, queryClient]);

  const windMutation = useMutation({
    mutationFn: (body: { speedMs: number; directionDeg: number; gustMs?: number }) =>
      api.post(`/competitions/${activeCompetitionId}/weather/wind`, {
        ...body,
        source: 'scoring',
      }),
    onSuccess: (reading) => {
      queryClient.setQueryData(['wind', activeCompetitionId], reading);
      setWindDialogOpen(false);
      setWindError(null);
      toast({ title: 'Wind recorded', description: 'Live boards show this reading.' });
    },
    onError: (err) => {
      setWindError(err instanceof Error ? err.message : 'Failed to record wind');
    },
  });

  const openWindDialog = () => {
    setWindSpeedMs(latestWind ? String(latestWind.speedMs) : '');
    setWindDirectionDeg(latestWind ? String(Math.round(latestWind.directionDeg)) : '');
    setWindGustMs(latestWind?.gustMs != null ? String(latestWind.gustMs) : '');
    setWindError(null);
    setWindDialogOpen(true);
  };

  const submitWind = () => {
    const speedMs = Number(windSpeedMs);
    const directionDeg = windDirectionDeg.trim() === '' ? (latestWind?.directionDeg ?? 0) : Number(windDirectionDeg);
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
    onSuccess: async (_result, saved) => {
      // Keep the same pilot selected and show the values that were just saved
      reset({
        flightId: saved.flightId,
        distanceCm: saved.distanceCm,
        resultType: saved.resultType,
        penaltyCm: saved.penaltyCm ?? 0,
        judgeNotes: saved.judgeNotes,
      });
      setSelectedFlightId(saved.flightId);

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['flights', activeCompetitionId, selectedRoundId],
        }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['rankings'] }),
        queryClient.invalidateQueries({ queryKey: ['rounds', activeCompetitionId] }),
      ]);
    },
  });

  const goToNextUnscored = () => {
    if (!flights?.length) return;
    const currentIndex = flights.findIndex((f) => f.id === selectedFlightId);
    const next =
      flights.slice(currentIndex + 1).find((f) => f.status !== 'SCORED') ??
      flights.find((f) => f.status !== 'SCORED' && f.id !== selectedFlightId);
    if (next) selectFlight(next);
  };

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

  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState('');

  const roundStateMutation = useMutation({
    mutationFn: (input: { action: 'pause'; reason: string } | { action: 'resume' }) =>
      api.post(
        `/competitions/${activeCompetitionId}/rounds/${selectedRoundId}/${input.action}`,
        input.action === 'pause' ? { reason: input.reason } : undefined,
      ),
    onSuccess: () => {
      setPauseOpen(false);
      setPauseReason('');
      queryClient.invalidateQueries({ queryKey: ['rounds', activeCompetitionId] });
    },
  });

  const selectedRound = rounds?.find((r) => r.id === selectedRoundId);
  const scoresReadOnly =
    !!selectedRound && ['APPROVED', 'LOCKED'].includes(selectedRound.status);

  // Locked/approved rounds: clear any score-entry selection
  useEffect(() => {
    if (scoresReadOnly) {
      setSelectedFlightId(null);
      scoreMutation.reset();
    }
  }, [scoresReadOnly, selectedRoundId]);

  const selectFlight = (flight: Flight) => {
    if (scoresReadOnly) return;
    scoreMutation.reset();
    setSelectedFlightId(flight.id);
    reset({
      flightId: flight.id,
      distanceCm: flight.distanceCm,
      resultType: flight.resultType ?? 'MEASURED',
      penaltyCm: 0,
    });
    // On smaller layouts the form sits below the list — bring it into view
    requestAnimationFrame(() => {
      document.getElementById('score-entry-panel')?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    });
  };

  const quickResult = (type: ScoreResultType, distance: number | null = null) => {
    if (!selectedFlightId) return;
    setValue('resultType', type);
    setValue('distanceCm', distance);
  };

  if (!activeCompetitionId || !orgId) {
    return <p className="text-muted-foreground"><Link to={competitionsHref} className="text-primary underline">Open a competition</Link> from the Competitions list.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Scoring</h1>
        <p className="text-muted-foreground">Enter and confirm flight scores by round</p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-full max-w-xs space-y-2">
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

        <div className="space-y-2">
          <Label>Wind</Label>
          <div className="flex h-10 items-center gap-3 rounded-md border bg-card px-3">
            <Wind className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-sm">
              {latestWind
                ? `${latestWind.speedMs.toFixed(1)} m/s · ${Math.round(latestWind.directionDeg)}°`
                : 'Not reported'}
            </span>
            {canUpdateWeather && (
              <Button type="button" size="sm" variant="outline" onClick={openWindDialog}>
                Record
              </Button>
            )}
          </div>
        </div>

        {canManageRounds && selectedRound?.status === 'ACTIVE' ? (
          <Button
            type="button"
            variant="outline"
            disabled={roundStateMutation.isPending}
            onClick={() => {
              setPauseReason('');
              setPauseOpen(true);
            }}
          >
            <Pause className="mr-2 h-4 w-4" />
            Pause round
          </Button>
        ) : null}
        {canManageRounds && selectedRound?.status === 'PAUSED' ? (
          <Button
            type="button"
            disabled={roundStateMutation.isPending}
            onClick={() => roundStateMutation.mutate({ action: 'resume' })}
          >
            <Play className="mr-2 h-4 w-4" />
            Resume round
          </Button>
        ) : null}
      </div>

      {selectedRound?.status === 'PAUSED' ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          {`Round ${selectedRound.number} is paused${
            selectedRound.pauseReason ? ` — ${selectedRound.pauseReason}` : ''
          }. Public pages show this until you resume.`}
        </p>
      ) : null}

      {selectedRoundId && (
        <div className="space-y-4">
          {selectedRound && ['CLOSED', 'PENDING_APPROVAL'].includes(selectedRound.status) && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
              <p>
                Round is <strong>{selectedRound.status}</strong>. You can still enter or correct
                scores until it is approved. After approve, scores freeze; Lock makes the round
                final.
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

          {selectedRound && selectedRound.status === 'APPROVED' && (
            <div className="rounded-lg border border-secondary/40 bg-secondary/10 px-4 py-3 text-sm">
              Round is <strong>APPROVED</strong> — scores cannot be edited. Reopen from Rounds to
              correct, or Lock to make results final.
            </div>
          )}

          {selectedRound && selectedRound.status === 'LOCKED' && (
            <div className="rounded-lg border px-4 py-3 text-sm text-muted-foreground">
              Round is <strong>LOCKED</strong> — scores and round details are final and cannot be
              changed.
            </div>
          )}

          {!flights?.length && (
            <div className="rounded-lg border px-4 py-3 text-sm text-muted-foreground">
              No flights in this round yet.{' '}
              <Link
                className="text-primary underline"
                to={competitionPath(orgId, activeCompetitionId, 'rounds')}
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

        <div className={`grid items-start gap-6 ${scoresReadOnly ? '' : 'lg:grid-cols-3'}`}>
          <div
            className={`max-h-[min(70vh,40rem)] overflow-auto rounded-lg border lg:max-h-[calc(100vh-11rem)] ${
              scoresReadOnly ? '' : 'lg:col-span-2'
            }`}
          >
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background shadow-[0_1px_0_0_hsl(var(--border))]">
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
                    className={
                      scoresReadOnly
                        ? undefined
                        : flight.id === selectedFlightId
                          ? 'bg-secondary/10 cursor-pointer'
                          : 'cursor-pointer'
                    }
                    onClick={scoresReadOnly ? undefined : () => selectFlight(flight)}
                  >
                    <TableCell>{flight.order}</TableCell>
                    <TableCell className="font-mono">{flight.pilotNumber}</TableCell>
                    <TableCell>{flight.pilotName}</TableCell>
                    <TableCell>{flight.country}</TableCell>
                    <TableCell>{formatFlightScore(flight)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{flight.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {!scoresReadOnly && (
          <Card
            id="score-entry-panel"
            className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-11rem)] lg:overflow-y-auto"
          >
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

                  <div className="space-y-2">
                    <Label>Quick result</Label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={resultType === 'MEASURED' ? 'default' : 'outline'}
                        onClick={() => {
                          setValue('resultType', 'MEASURED');
                          if (watch('distanceCm') == null) setValue('distanceCm', null);
                        }}
                      >
                        Measured
                      </Button>
                      {(
                        [
                          ['BULLSEYE', 'Bullseye', 0],
                          ['DNF', 'DNF', null],
                          ['ABS', 'ABS', null],
                          ['DNS', 'DNS', null],
                          ['REFLIGHT', 'Reflight', null],
                          ['MAXIMUM', 'Maximum', maximumScoreCm],
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
                  </div>

                  <div className="space-y-2">
                    <Label>Distance (cm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      disabled={['DNF', 'ABS', 'DNS', 'REFLIGHT'].includes(resultType)}
                      {...(() => {
                        const field = register('distanceCm', {
                          setValueAs: (v) => (v === '' || v == null ? null : Number(v)),
                        });
                        return {
                          ...field,
                          onChange: (e: ChangeEvent<HTMLInputElement>) => {
                            void field.onChange(e);
                            if (e.target.value !== '') {
                              setValue('resultType', 'MEASURED');
                            }
                          },
                        };
                      })()}
                    />
                    {errors.distanceCm && (
                      <p className="text-sm text-destructive">{errors.distanceCm.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Enter a measured landing distance, or use a quick result above.
                    </p>
                  </div>

                  <input type="hidden" {...register('resultType')} />

                  <div className="space-y-2">
                    <Label>
                      {resultType === 'REFLIGHT' ? 'Reason' : 'Judge notes'}
                    </Label>
                    <Textarea
                      {...register('judgeNotes')}
                      rows={2}
                      maxLength={1000}
                      required={resultType === 'REFLIGHT'}
                      placeholder={
                        resultType === 'REFLIGHT' ? 'Wind above the limit' : undefined
                      }
                    />
                    {errors.judgeNotes ? (
                      <p className="text-sm text-destructive">{errors.judgeNotes.message}</p>
                    ) : null}
                    {resultType === 'REFLIGHT' ? (
                      <p className="text-xs text-muted-foreground">
                        Required. This reason is posted to the public feed.
                      </p>
                    ) : null}
                  </div>

                  <input type="hidden" {...register('flightId')} />

                  {scoreMutation.isSuccess && !scoreMutation.isPending && (
                    <p className="rounded-md bg-emerald-500/15 px-3 py-2 text-sm text-emerald-400">
                      Score saved
                      {watch('resultType') === 'DNF'
                        ? ' as DNF'
                        : watch('resultType') === 'BULLSEYE'
                          ? ' as Bullseye'
                          : watch('distanceCm') != null
                            ? ` · ${formatScoreCm(watch('distanceCm'))} cm`
                            : ''}
                      .
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={
                        scoreMutation.isPending ||
                        (resultType === 'REFLIGHT' && !watch('judgeNotes')?.trim())
                      }
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {scoreMutation.isPending ? 'Saving…' : 'Save Score'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!flights?.some((f) => f.status !== 'SCORED')}
                      onClick={goToNextUnscored}
                    >
                      Next
                    </Button>
                  </div>
                </form>
              ) : (
                <p className="text-sm text-muted-foreground">Select a flight from the list to enter a score.</p>
              )}
            </CardContent>
          </Card>
          )}
        </div>
        </div>
      )}

      <Dialog open={windDialogOpen} onOpenChange={setWindDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record wind</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="scoring-wind-speed">Speed (m/s)</Label>
              <Input
                id="scoring-wind-speed"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.1"
                value={windSpeedMs}
                onChange={(e) => setWindSpeedMs(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scoring-wind-direction">Direction (°)</Label>
              <Input
                id="scoring-wind-direction"
                type="number"
                inputMode="numeric"
                min={0}
                max={360}
                step="1"
                value={windDirectionDeg}
                onChange={(e) => setWindDirectionDeg(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scoring-wind-gust">Gust (m/s, optional)</Label>
              <Input
                id="scoring-wind-gust"
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

      <Dialog open={pauseOpen} onOpenChange={setPauseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pause round {selectedRound?.number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pause-reason">Reason</Label>
            <Textarea
              id="pause-reason"
              value={pauseReason}
              onChange={(event) => setPauseReason(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Wind above the limit"
              required
            />
            <p className="text-xs text-muted-foreground">
              Shown on the public pages and the venue display until the round resumes.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPauseOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={roundStateMutation.isPending || !pauseReason.trim()}
              onClick={() =>
                roundStateMutation.mutate({ action: 'pause', reason: pauseReason.trim() })
              }
            >
              {roundStateMutation.isPending ? 'Pausing…' : 'Pause round'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

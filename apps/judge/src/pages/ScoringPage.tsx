import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CheckCircle, Pause, Play, Square } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
} from '@aero-judge/ui';
import type { EnterScoreInput, RuleConfig, ScoreResultType } from '@aero-judge/shared';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { roundsPath } from '../lib/paths';
import { connectSocket, onSocketEvent } from '../lib/socket';
import {
  enqueueScore,
  getPendingCount,
  subscribeOnlineSync,
  syncPendingScores,
} from '../lib/offline-queue';
import { PilotDisplay } from '../components/PilotDisplay';
import { NumericKeypad } from '../components/NumericKeypad';
import { QuickScoreButtons } from '../components/QuickScoreButtons';
import { OnDeckList } from '../components/OnDeckList';
import { OfflineIndicator } from '../components/OfflineIndicator';
import { SwitchToAdminButton } from '../components/SwitchToAdminButton';
import { WindSpeedDialog, type WindDraft } from '../components/WindSpeedDialog';

interface Flight {
  id: string;
  order: number;
  pilotId: string;
  pilotNumber: number;
  firstName: string;
  lastName: string;
  country: string;
  countryCode?: string;
  status: 'PENDING' | 'ON_DECK' | 'CURRENT' | 'SCORED';
  distanceCm: number | null;
  resultType: ScoreResultType | null;
  finalScoreCm?: number | null;
}

export function ScoringPage() {
  const { organizationId, competitionId, roundId } = useParams<{
    organizationId: string;
    competitionId: string;
    roundId: string;
  }>();
  const { setCompetitionId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (competitionId) setCompetitionId(competitionId);
  }, [competitionId, setCompetitionId]);

  const roundsHref =
    organizationId && competitionId ? roundsPath(organizationId, competitionId) : '/login';
  const [currentIndex, setCurrentIndex] = useState(0);
  const [distanceInput, setDistanceInput] = useState('');
  const [resultType, setResultType] = useState<ScoreResultType>('MEASURED');
  const [reflightReason, setReflightReason] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(getPendingCount());
  const [confirmed, setConfirmed] = useState(false);
  const [pilotPickerOpen, setPilotPickerOpen] = useState(false);
  const [windOpen, setWindOpen] = useState(false);

  const { data: flights, refetch } = useQuery({
    queryKey: ['judge-flights', competitionId, roundId],
    queryFn: () => api.get<Flight[]>(`/competitions/${competitionId}/rounds/${roundId}/flights`),
    enabled: !!competitionId && !!roundId,
    refetchInterval: 30_000,
  });

  const { data: roundMeta } = useQuery({
    queryKey: ['judge-round', competitionId, roundId],
    queryFn: () =>
      api.get<{
        id: string;
        status: string;
        number: number;
        name: string | null;
        pauseReason: string | null;
      }>(
        `/competitions/${competitionId}/rounds/${roundId}`,
      ),
    enabled: !!competitionId && !!roundId,
  });

  const scoresReadOnly =
    !!roundMeta && ['APPROVED', 'LOCKED'].includes(roundMeta.status);
  const canUpdateWind =
    isOnline &&
    !!roundMeta &&
    ['ACTIVE', 'OPEN', 'PAUSED', 'BRIEFING'].includes(roundMeta.status);

  const { data: latestWind } = useQuery({
    queryKey: ['wind', competitionId],
    queryFn: () =>
      api.get<{ speedMs: number; directionDeg: number } | null>(
        `/competitions/${competitionId}/weather/wind/latest`,
      ),
    enabled: !!competitionId,
  });

  const windMutation = useMutation({
    mutationFn: (wind: WindDraft) =>
      api.post(`/competitions/${competitionId}/weather/wind`, {
        speedMs: wind.speedMs,
        directionDeg: wind.directionDeg,
        source: 'scorer',
      }),
    onSuccess: (reading) => {
      queryClient.setQueryData(['wind', competitionId], reading);
      setWindOpen(false);
    },
  });

  const { data: rules } = useQuery({
    queryKey: ['settings', competitionId],
    queryFn: () => api.get<RuleConfig>(`/competitions/${competitionId}/rules`),
    enabled: !!competitionId,
  });

  const maximumScoreCm = rules?.maximumScoreCm ?? 1000;

  const currentFlight = flights?.[currentIndex] ?? null;

  useEffect(() => {
    if (competitionId && roundId) connectSocket(competitionId, roundId);
  }, [competitionId, roundId]);

  useEffect(() => {
    if (!competitionId) return;
    const unsubFlight = onSocketEvent('flight:status', () => refetch());
    const unsubPilot = onSocketEvent('pilot:current', () => refetch());
    const unsubScore = onSocketEvent('score:updated', () => refetch());
    const unsubWind = onSocketEvent('wind:updated', (payload) => {
      if (payload.competitionId !== competitionId) return;
      queryClient.setQueryData(['wind', competitionId], {
        speedMs: payload.speedMs,
        directionDeg: payload.directionDeg,
      });
    });
    return () => {
      unsubFlight();
      unsubPilot();
      unsubScore();
      unsubWind();
    };
  }, [competitionId, queryClient, refetch]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const unsubSync = subscribeOnlineSync(setPendingCount);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      unsubSync();
    };
  }, []);

  useEffect(() => {
    if (currentFlight) {
      setDistanceInput(currentFlight.distanceCm?.toString() ?? '');
      setResultType(currentFlight.resultType ?? 'MEASURED');
      setReflightReason('');
      setConfirmed(false);
    }
  }, [currentFlight?.id]);

  const submitScore = useCallback(
    async (score: EnterScoreInput) => {
      if (!competitionId || !roundId) return;
      if (scoresReadOnly) return;

      if (!isOnline) {
        enqueueScore(competitionId, roundId, score);
        setPendingCount(getPendingCount());
        setConfirmed(true);
        return;
      }

      try {
        await api.post(`/competitions/${competitionId}/rounds/${roundId}/scores`, score);
        setConfirmed(true);
        queryClient.invalidateQueries({ queryKey: ['judge-flights'] });
      } catch {
        enqueueScore(competitionId, roundId, score);
        setPendingCount(getPendingCount());
        setConfirmed(true);
      }
    },
    [competitionId, roundId, isOnline, queryClient, scoresReadOnly],
  );

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!currentFlight || scoresReadOnly) return;
      const distanceCm =
        resultType === 'MEASURED' ? (distanceInput ? parseFloat(distanceInput) : null) : null;
      await submitScore({
        flightId: currentFlight.id,
        distanceCm:
          resultType === 'BULLSEYE' ? 0 : resultType === 'MAXIMUM' ? maximumScoreCm : distanceCm,
        resultType,
        penaltyCm: 0,
        judgeNotes: resultType === 'REFLIGHT' ? reflightReason.trim() : undefined,
      });
    },
  });

  const handleQuickSelect = (type: ScoreResultType, distance: number | null) => {
    if (scoresReadOnly) return;
    setConfirmed(false);
    confirmMutation.reset();

    // Tap again to clear special result and return to measured keypad entry
    if (resultType === type && type !== 'MEASURED') {
      setResultType('MEASURED');
      setDistanceInput('');
      setReflightReason('');
      return;
    }

    setResultType(type);
    if (distance !== null) setDistanceInput(String(distance));
    else if (type !== 'MEASURED') setDistanceInput('');
  };

  const handleDistanceChange = (v: string) => {
    if (scoresReadOnly) return;
    setDistanceInput(v);
    setResultType('MEASURED');
    setReflightReason('');
    setConfirmed(false);
    confirmMutation.reset();
  };

  const selectPilot = (flightId: string) => {
    if (!flights) return;
    const idx = flights.findIndex((f) => f.id === flightId);
    if (idx >= 0) {
      setCurrentIndex(idx);
      setConfirmed(false);
      confirmMutation.reset();
    }
  };

  const handleSync = async () => {
    const result = await syncPendingScores();
    setPendingCount(getPendingCount());
    if (result.synced > 0) refetch();
  };

  const canConfirm =
    !confirmMutation.isPending &&
    !confirmed &&
    !scoresReadOnly &&
    !!currentFlight &&
    (resultType !== 'MEASURED' || distanceInput !== '') &&
    (resultType !== 'REFLIGHT' || reflightReason.trim() !== '');

  const allScored = useMemo(
    () =>
      !!flights?.length &&
      flights.every((f) => f.status === 'SCORED' || f.resultType != null),
    [flights],
  );

  const canCloseRound =
    !!roundMeta && ['ACTIVE', 'PAUSED', 'OPEN'].includes(roundMeta.status) && allScored;

  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState('');

  const roundStateMutation = useMutation({
    mutationFn: (input: { action: 'pause'; reason: string } | { action: 'resume' }) =>
      api.post(
        `/competitions/${competitionId}/rounds/${roundId}/${input.action}`,
        input.action === 'pause' ? { reason: input.reason } : undefined,
      ),
    onSuccess: () => {
      setPauseOpen(false);
      setPauseReason('');
      queryClient.invalidateQueries({ queryKey: ['judge-round', competitionId, roundId] });
      queryClient.invalidateQueries({ queryKey: ['rounds', competitionId] });
    },
  });

  const closeMutation = useMutation({
    mutationFn: () => api.post(`/competitions/${competitionId}/rounds/${roundId}/close`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rounds', competitionId] });
      queryClient.invalidateQueries({ queryKey: ['judge-round', competitionId, roundId] });
      queryClient.invalidateQueries({ queryKey: ['judge-flights', competitionId, roundId] });
      navigate(roundsHref);
    },
  });

  if (!competitionId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        <p>No competition selected.</p>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-900 text-white">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-700 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <Button variant="ghost" size="sm" onClick={() => navigate(roundsHref)} className="text-slate-400">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Rounds
        </Button>
        <div className="text-center">
          <p className="font-mono text-base font-bold text-sky-400">
            R{roundMeta?.number ?? '—'}
            {roundMeta?.status ? (
              <span className="ml-2 text-xs font-normal text-slate-400">{roundMeta.status}</span>
            ) : null}
          </p>
          {roundMeta?.status === 'ACTIVE' || roundMeta?.status === 'PAUSED' ? (
            <Button
              size="sm"
              variant={roundMeta.status === 'PAUSED' ? 'default' : 'secondary'}
              className="mt-1 h-7 px-2 text-xs"
              disabled={roundStateMutation.isPending}
              onClick={() => {
                if (roundMeta.status === 'PAUSED') {
                  roundStateMutation.mutate({ action: 'resume' });
                  return;
                }
                setPauseReason('');
                setPauseOpen(true);
              }}
            >
              {roundMeta.status === 'PAUSED' ? (
                <>
                  <Play className="mr-1 h-3 w-3" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="mr-1 h-3 w-3" />
                  Pause
                </>
              )}
            </Button>
          ) : null}
          <p className="text-[10px] text-slate-500">
            Pilot {currentIndex + 1}/{flights?.length ?? 0}
          </p>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <SwitchToAdminButton
            compact
            className="text-slate-400 hover:text-white"
          />
          <OfflineIndicator pendingCount={pendingCount} isOnline={isOnline} />
          {pendingCount > 0 && isOnline && (
            <Button size="sm" variant="secondary" onClick={handleSync}>
              Sync {pendingCount}
            </Button>
          )}
        </div>
      </header>

      <button
        type="button"
        className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/80 px-3 py-1.5 text-left"
        onClick={() => {
          if (canUpdateWind) setWindOpen(true);
        }}
        disabled={!canUpdateWind}
      >
        <span className="text-[10px] uppercase tracking-wider text-slate-500">Wind</span>
        <span className="font-mono text-sm text-sky-300">
          {latestWind
            ? `${latestWind.speedMs.toFixed(1)} m/s · ${Math.round(latestWind.directionDeg)}°`
            : 'Not reported'}
        </span>
        {canUpdateWind ? <span className="text-xs text-sky-400">Update</span> : <span className="w-10" />}
      </button>

      <div className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 grid-cols-1 gap-2 overflow-hidden p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:gap-3 sm:p-3 lg:grid-cols-[minmax(0,1fr)_220px] lg:gap-4 lg:p-4">
        <section className="flex min-h-0 flex-col gap-1.5 overflow-hidden sm:gap-2">
          {roundMeta?.status === 'PAUSED' && (
            <div className="shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              {`Round ${roundMeta.number} is paused${
                roundMeta.pauseReason ? ` — ${roundMeta.pauseReason}` : ''
              }. Public pages show this until you resume.`}
            </div>
          )}

          {scoresReadOnly && (
            <div className="shrink-0 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-slate-300">
              Round is <strong>{roundMeta?.status}</strong> — scores are final.
            </div>
          )}

          <AnimatePresence mode="wait">
            {currentFlight && (
              <motion.div
                key={currentFlight.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="shrink-0"
              >
                <PilotDisplay
                  pilots={
                    flights?.map((f) => ({
                      id: f.id,
                      pilotNumber: f.pilotNumber,
                      firstName: f.firstName,
                      lastName: f.lastName,
                      status: f.status,
                      distanceCm: f.distanceCm,
                      resultType: f.resultType,
                      finalScoreCm: f.finalScoreCm,
                    })) ?? []
                  }
                  selectedId={currentFlight.id}
                  onSelect={selectPilot}
                  firstName={currentFlight.firstName}
                  lastName={currentFlight.lastName}
                  country={currentFlight.country}
                  countryCode={currentFlight.countryCode}
                  onOpenChange={setPilotPickerOpen}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="shrink-0">
            <QuickScoreButtons
              selected={resultType}
              onSelect={handleQuickSelect}
              disabled={confirmMutation.isPending || scoresReadOnly}
              maximumScoreCm={maximumScoreCm}
            />
          </div>

          {resultType !== 'MEASURED' && !scoresReadOnly && (
            <p className="shrink-0 text-center text-xs text-slate-400">
              Tap <strong className="text-slate-200">{resultType}</strong> again to enter a measured
              distance
            </p>
          )}

          {resultType === 'REFLIGHT' && !scoresReadOnly && (
            <label className="block shrink-0">
              <span className="mb-1 block text-center text-xs font-medium uppercase tracking-wide text-sky-300">
                Reason
              </span>
              <textarea
                value={reflightReason}
                onChange={(event) => setReflightReason(event.target.value)}
                maxLength={1000}
                rows={2}
                placeholder="Wind above the limit"
                className="w-full resize-none rounded-lg border border-sky-500/60 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <span className="mt-1 block text-center text-[11px] text-slate-400">
                Required. Posted to the public feed.
              </span>
            </label>
          )}

          <div className="min-h-0 flex-1">
            <NumericKeypad
              value={distanceInput}
              onChange={handleDistanceChange}
              disabled={confirmMutation.isPending || scoresReadOnly || resultType !== 'MEASURED'}
              keyboardEnabled={!pilotPickerOpen}
              fill
            />
          </div>

          <div className="flex shrink-0 flex-col gap-1.5">
            {canCloseRound && (
              <div className="rounded-lg border border-emerald-600/40 bg-emerald-950/40 px-3 py-2">
                <p className="mb-1.5 text-center text-xs text-emerald-300">
                  All {flights?.length ?? 0} pilots scored
                </p>
                <Button
                  size="lg"
                  className="h-11 w-full bg-emerald-600 text-base font-bold hover:bg-emerald-500 sm:h-12"
                  disabled={closeMutation.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        'Close this round? Unscored flights (if any) will be recorded as DNF. You can then start the next round.',
                      )
                    ) {
                      closeMutation.mutate();
                    }
                  }}
                >
                  <Square className="mr-2 h-4 w-4" />
                  {closeMutation.isPending ? 'Closing…' : 'Close Round'}
                </Button>
                {closeMutation.isError && (
                  <p className="mt-1.5 text-center text-xs text-red-400">
                    {closeMutation.error instanceof ApiError
                      ? closeMutation.error.message
                      : 'Failed to close round'}
                  </p>
                )}
              </div>
            )}

            {roundMeta &&
              ['CLOSED', 'PENDING_APPROVAL'].includes(roundMeta.status) &&
              !canCloseRound && (
                <Button
                  size="lg"
                  className="h-11 w-full text-base font-bold sm:h-12"
                  onClick={() => navigate(roundsHref)}
                >
                  Round closed — start next round
                </Button>
              )}

            <Button
              size="lg"
              className="h-12 w-full text-base font-bold sm:h-14 sm:text-lg"
              disabled={!canConfirm}
              onClick={() => confirmMutation.mutate()}
            >
              {confirmed ? (
                <>
                  <CheckCircle className="mr-2 h-5 w-5" />
                  Score Saved
                </>
              ) : (
                'Confirm Score'
              )}
            </Button>

            {confirmed && !scoresReadOnly && (
              <div className="flex justify-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setConfirmed(false);
                    confirmMutation.reset();
                  }}
                >
                  Edit score
                </Button>
                {flights && currentIndex < flights.length - 1 && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setCurrentIndex((i) => i + 1);
                      setConfirmed(false);
                      confirmMutation.reset();
                    }}
                  >
                    Next pilot
                  </Button>
                )}
              </div>
            )}
          </div>
        </section>

        <aside className="hidden min-h-0 overflow-hidden rounded-xl bg-slate-800/50 p-3 lg:flex lg:flex-col">
          <OnDeckList
            pilots={
              flights?.map((f) => ({
                id: f.id,
                pilotNumber: f.pilotNumber,
                firstName: f.firstName,
                lastName: f.lastName,
                status:
                  f.id === currentFlight?.id
                    ? 'CURRENT'
                    : f.status === 'SCORED'
                      ? 'SCORED'
                      : f.status === 'ON_DECK'
                        ? 'ON_DECK'
                        : 'PENDING',
                distanceCm: f.distanceCm,
                resultType: f.resultType,
                finalScoreCm: f.finalScoreCm,
              })) ?? []
            }
            currentId={currentFlight?.id ?? null}
            onSelect={selectPilot}
          />
        </aside>
      </div>
      <WindSpeedDialog
        open={windOpen}
        title="Update wind"
        confirmLabel="Save wind"
        initialSpeed={latestWind?.speedMs}
        initialDirection={latestWind?.directionDeg}
        busy={windMutation.isPending}
        error={windMutation.error instanceof ApiError ? windMutation.error.message : null}
        onClose={() => {
          if (!windMutation.isPending) setWindOpen(false);
        }}
        onConfirm={(wind) => windMutation.mutate(wind)}
      />
      <Dialog open={pauseOpen} onOpenChange={setPauseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pause round {roundMeta?.number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="judge-pause-reason">Reason</Label>
            <Textarea
              id="judge-pause-reason"
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
            <Button type="button" variant="secondary" onClick={() => setPauseOpen(false)}>
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

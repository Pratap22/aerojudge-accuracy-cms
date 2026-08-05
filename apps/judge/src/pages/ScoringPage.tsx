import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CheckCircle, Square } from 'lucide-react';
import { Button } from '@npha/ui';
import type { EnterScoreInput, RuleConfig, ScoreResultType } from '@npha/shared';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
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
  const { roundId } = useParams<{ roundId: string }>();
  const { competitionId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [distanceInput, setDistanceInput] = useState('');
  const [resultType, setResultType] = useState<ScoreResultType>('MEASURED');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(getPendingCount());
  const [confirmed, setConfirmed] = useState(false);
  const [pilotPickerOpen, setPilotPickerOpen] = useState(false);

  const { data: flights, refetch } = useQuery({
    queryKey: ['judge-flights', competitionId, roundId],
    queryFn: () => api.get<Flight[]>(`/competitions/${competitionId}/rounds/${roundId}/flights`),
    enabled: !!competitionId && !!roundId,
    refetchInterval: 30_000,
  });

  const { data: roundMeta } = useQuery({
    queryKey: ['judge-round', competitionId, roundId],
    queryFn: () =>
      api.get<{ id: string; status: string; number: number; name: string | null }>(
        `/competitions/${competitionId}/rounds/${roundId}`,
      ),
    enabled: !!competitionId && !!roundId,
  });

  const scoresReadOnly =
    !!roundMeta && ['APPROVED', 'LOCKED'].includes(roundMeta.status);

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
    return () => {
      unsubFlight();
      unsubPilot();
      unsubScore();
    };
  }, [competitionId, refetch]);

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
    (resultType !== 'MEASURED' || distanceInput !== '');

  const allScored = useMemo(
    () =>
      !!flights?.length &&
      flights.every((f) => f.status === 'SCORED' || f.resultType != null),
    [flights],
  );

  const canCloseRound =
    !!roundMeta && ['ACTIVE', 'PAUSED', 'OPEN'].includes(roundMeta.status) && allScored;

  const closeMutation = useMutation({
    mutationFn: () => api.post(`/competitions/${competitionId}/rounds/${roundId}/close`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rounds', competitionId] });
      queryClient.invalidateQueries({ queryKey: ['judge-round', competitionId, roundId] });
      queryClient.invalidateQueries({ queryKey: ['judge-flights', competitionId, roundId] });
      navigate('/rounds');
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
        <Button variant="ghost" size="sm" onClick={() => navigate('/rounds')} className="text-slate-400">
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
          <p className="text-[10px] text-slate-500">
            Pilot {currentIndex + 1}/{flights?.length ?? 0}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <OfflineIndicator pendingCount={pendingCount} isOnline={isOnline} />
          {pendingCount > 0 && isOnline && (
            <Button size="sm" variant="secondary" onClick={handleSync}>
              Sync {pendingCount}
            </Button>
          )}
        </div>
      </header>

      <div className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 grid-cols-1 gap-2 overflow-hidden p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:gap-3 sm:p-3 lg:grid-cols-[minmax(0,1fr)_220px] lg:gap-4 lg:p-4">
        <section className="flex min-h-0 flex-col gap-1.5 overflow-hidden sm:gap-2">
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
                  onClick={() => navigate('/rounds')}
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
    </div>
  );
}

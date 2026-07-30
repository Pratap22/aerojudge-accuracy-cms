import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import { Button } from '@npha/ui';
import type { EnterScoreInput, ScoreResultType } from '@npha/shared';
import { api } from '../lib/api';
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

  const { data: flights, refetch } = useQuery({
    queryKey: ['judge-flights', competitionId, roundId],
    queryFn: () => api.get<Flight[]>(`/competitions/${competitionId}/rounds/${roundId}/flights`),
    enabled: !!competitionId && !!roundId,
    refetchInterval: 30_000,
  });

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
    [competitionId, roundId, isOnline, queryClient],
  );

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!currentFlight) return;
      const distanceCm =
        resultType === 'MEASURED' ? (distanceInput ? parseFloat(distanceInput) : null) : null;
      await submitScore({
        flightId: currentFlight.id,
        distanceCm: resultType === 'BULLSEYE' ? 0 : resultType === 'MAXIMUM' ? 1000 : distanceCm,
        resultType,
        penaltyCm: 0,
      });
    },
  });

  const handleQuickSelect = (type: ScoreResultType, distance: number | null) => {
    setResultType(type);
    if (distance !== null) setDistanceInput(String(distance));
    else if (type !== 'MEASURED') setDistanceInput('');
  };

  const goNext = () => {
    if (flights && currentIndex < flights.length - 1) {
      setCurrentIndex((i) => i + 1);
      setConfirmed(false);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setConfirmed(false);
    }
  };

  const handleSync = async () => {
    const result = await syncPendingScores();
    setPendingCount(getPendingCount());
    if (result.synced > 0) refetch();
  };

  if (!competitionId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        <p>No competition selected.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/rounds')} className="text-slate-400">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Rounds
        </Button>
        <OfflineIndicator pendingCount={pendingCount} isOnline={isOnline} />
        {pendingCount > 0 && isOnline && (
          <Button size="sm" variant="secondary" onClick={handleSync}>
            Sync {pendingCount}
          </Button>
        )}
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 p-4 lg:grid-cols-3 lg:p-6">
        <div className="lg:col-span-2 space-y-6">
          <AnimatePresence mode="wait">
            {currentFlight && (
              <motion.div
                key={currentFlight.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <PilotDisplay
                  pilotNumber={currentFlight.pilotNumber}
                  firstName={currentFlight.firstName}
                  lastName={currentFlight.lastName}
                  country={currentFlight.country}
                  countryCode={currentFlight.countryCode}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <QuickScoreButtons
            selected={resultType}
            onSelect={handleQuickSelect}
            disabled={confirmMutation.isPending}
          />

          <NumericKeypad
            value={distanceInput}
            onChange={(v) => {
              setDistanceInput(v);
              setResultType('MEASURED');
            }}
            disabled={confirmMutation.isPending || resultType !== 'MEASURED'}
          />

          <div className="flex gap-3">
            <Button
              size="lg"
              className="h-16 flex-1 text-xl font-bold"
              disabled={confirmMutation.isPending || confirmed}
              onClick={() => confirmMutation.mutate()}
            >
              {confirmed ? (
                <>
                  <CheckCircle className="mr-2 h-6 w-6" />
                  Score Saved
                </>
              ) : (
                'Confirm Score'
              )}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="lg"
              className="h-14 px-6 border-slate-600"
              disabled={currentIndex === 0}
              onClick={goPrev}
            >
              <ChevronLeft className="mr-1 h-5 w-5" />
              Previous
            </Button>
            <span className="text-sm text-slate-400">
              {currentIndex + 1} / {flights?.length ?? 0}
            </span>
            <Button
              variant="outline"
              size="lg"
              className="h-14 px-6 border-slate-600"
              disabled={!flights || currentIndex >= flights.length - 1}
              onClick={goNext}
            >
              Next
              <ChevronRight className="ml-1 h-5 w-5" />
            </Button>
          </div>
        </div>

        <aside className="rounded-xl bg-slate-800/50 p-4 lg:p-6">
          <OnDeckList
            pilots={
              flights?.map((f) => ({
                id: f.id,
                pilotNumber: f.pilotNumber,
                firstName: f.firstName,
                lastName: f.lastName,
                status: f.id === currentFlight?.id ? 'CURRENT' : f.status === 'ON_DECK' ? 'ON_DECK' : 'PENDING',
              })) ?? []
            }
            currentId={currentFlight?.id ?? null}
          />
        </aside>
      </div>
    </div>
  );
}

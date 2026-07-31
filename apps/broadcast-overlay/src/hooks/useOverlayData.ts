import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import type { ComputedScore } from '@npha/shared';
import { fetchCompetition, fetchResults } from '../lib/api';
import { connectOverlaySocket, disconnectSocket, onSocketEvent } from '../lib/socket';
import type { RankChangeToast, WindData } from '../lib/types';
import type { PublicRankingRow } from '../lib/types';

export function useOverlayData() {
  const { competitionId: routeId } = useParams<{ competitionId: string }>();
  const slug = (routeId ?? '').trim();
  const queryClient = useQueryClient();

  const [currentPilotId, setCurrentPilotId] = useState<string | null>(null);
  const [latestScoreCm, setLatestScoreCm] = useState<number | null>(null);
  const [isBullseye, setIsBullseye] = useState(false);
  const [wind, setWind] = useState<WindData | null>(null);
  const [rankToasts, setRankToasts] = useState<RankChangeToast[]>([]);
  const [previousRanks, setPreviousRanks] = useState<Map<string, number>>(new Map());

  const competitionQuery = useQuery({
    queryKey: ['competition', slug],
    queryFn: () => fetchCompetition(slug),
    enabled: Boolean(slug),
  });

  const resultsQuery = useQuery({
    queryKey: ['results', slug],
    queryFn: () => fetchResults(slug),
    staleTime: 10_000,
    enabled: Boolean(slug),
  });

  const refreshResults = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['results', slug] });
  }, [queryClient, slug]);

  const showRankToast = useCallback((pilot: PublicRankingRow, oldRank: number, newRank: number) => {
    if (oldRank === newRank) return;
    const toast: RankChangeToast = {
      id: crypto.randomUUID(),
      pilotName: `${pilot.pilot.firstName} ${pilot.pilot.lastName}`,
      pilotNumber: pilot.pilot.pilotNumber,
      oldRank,
      newRank,
    };
    setRankToasts((prev) => [...prev, toast]);
    setTimeout(() => {
      setRankToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, 5000);
  }, []);

  useEffect(() => {
    const compId = competitionQuery.data?.id;
    if (!compId) return;

    connectOverlaySocket(compId);

    const unsubs = [
      onSocketEvent('pilot:current', (payload) => {
        if (payload.competitionId !== compId) return;
        setCurrentPilotId(payload.pilotId);
      }),
      onSocketEvent('score:updated', (payload) => {
        if (payload.competitionId !== compId) return;
        const score = payload.score as ComputedScore;
        setLatestScoreCm(score.finalScoreCm);
        setIsBullseye(score.isBullseye);
        refreshResults();
      }),
      onSocketEvent('ranking:updated', () => refreshResults()),
      onSocketEvent('wind:updated', (payload) => {
        if (payload.competitionId !== compId) return;
        setWind({ directionDeg: payload.directionDeg, speedMs: payload.speedMs });
      }),
    ];

    return () => {
      unsubs.forEach((u) => u());
      disconnectSocket();
    };
  }, [competitionQuery.data?.id, refreshResults]);

  useEffect(() => {
    const rankings = resultsQuery.data?.rankings ?? [];
    rankings.forEach((r) => {
      const prev = previousRanks.get(r.id);
      if (prev != null && prev !== r.rank) {
        showRankToast(r, prev, r.rank);
      }
    });
    setPreviousRanks(new Map(rankings.map((r) => [r.id, r.rank])));
  }, [resultsQuery.data?.rankings, showRankToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const rankings = resultsQuery.data?.rankings ?? [];
  const currentPilot = currentPilotId
    ? rankings.find((r) => r.id === currentPilotId) ?? rankings[0] ?? null
    : rankings[0] ?? null;

  return {
    competition: competitionQuery.data,
    currentPilot,
    latestScoreCm,
    isBullseye,
    wind,
    rankToasts,
    isLoading: Boolean(slug) && competitionQuery.isLoading,
  };
}

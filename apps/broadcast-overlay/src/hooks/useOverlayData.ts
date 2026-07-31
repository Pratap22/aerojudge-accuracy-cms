import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import type { ComputedScore } from '@npha/shared';
import { fetchCompetition, fetchLatestScore, fetchResults } from '../lib/api';
import { connectOverlaySocket, disconnectSocket, onSocketEvent } from '../lib/socket';
import type { RankChangeToast, WindData, PublicRankingRow } from '../lib/types';

interface LiveScoreState {
  pilotId: string;
  pilotNumber: number;
  firstName: string;
  lastName: string;
  countryCode: string;
  countryName: string | null;
  scoreCm: number | null;
  isBullseye: boolean;
  resultLabel?: string;
  roundNumber: number;
}

export function useOverlayData() {
  const { competitionId: routeId } = useParams<{ competitionId: string }>();
  const competitionKey = (routeId ?? '').trim();
  const queryClient = useQueryClient();

  const [currentPilotId, setCurrentPilotId] = useState<string | null>(null);
  const [liveScore, setLiveScore] = useState<LiveScoreState | null>(null);
  const [wind, setWind] = useState<WindData | null>(null);
  const [rankToasts, setRankToasts] = useState<RankChangeToast[]>([]);
  const [previousRanks, setPreviousRanks] = useState<Map<string, number>>(new Map());

  const competitionQuery = useQuery({
    queryKey: ['competition', competitionKey],
    queryFn: () => fetchCompetition(competitionKey),
    enabled: Boolean(competitionKey),
  });

  const resultsQuery = useQuery({
    queryKey: ['results', competitionKey],
    queryFn: () => fetchResults(competitionKey),
    staleTime: 10_000,
    enabled: Boolean(competitionKey),
  });

  const latestScoreQuery = useQuery({
    queryKey: ['latest-score', competitionKey],
    queryFn: () => fetchLatestScore(competitionKey),
    staleTime: 5_000,
    enabled: Boolean(competitionKey),
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['results', competitionKey] });
    queryClient.invalidateQueries({ queryKey: ['latest-score', competitionKey] });
  }, [queryClient, competitionKey]);

  const showRankToast = useCallback((pilot: PublicRankingRow, oldRank: number, newRank: number) => {
    if (oldRank === newRank || !pilot.pilot) return;
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

  // Seed from persisted latest score when no live event yet
  useEffect(() => {
    const persisted = latestScoreQuery.data;
    if (!persisted || liveScore) return;
    setLiveScore({
      pilotId: persisted.pilotId,
      pilotNumber: persisted.pilotNumber,
      firstName: persisted.firstName,
      lastName: persisted.lastName,
      countryCode: persisted.countryCode,
      countryName: persisted.countryName,
      scoreCm: persisted.scoreCm,
      isBullseye: persisted.isBullseye,
      resultLabel: persisted.resultLabel,
      roundNumber: persisted.roundNumber,
    });
    setCurrentPilotId((prev) => prev ?? persisted.pilotId);
  }, [latestScoreQuery.data, liveScore]);

  // Keep round / name details fresh from API after live score
  useEffect(() => {
    const persisted = latestScoreQuery.data;
    if (!persisted || !liveScore) return;
    if (persisted.pilotId !== liveScore.pilotId) return;
    if (liveScore.roundNumber > 0 && liveScore.firstName) return;
    setLiveScore((prev) =>
      prev
        ? {
            ...prev,
            roundNumber: prev.roundNumber || persisted.roundNumber,
            firstName: prev.firstName || persisted.firstName,
            lastName: prev.lastName || persisted.lastName,
            pilotNumber: prev.pilotNumber || persisted.pilotNumber,
            countryCode: prev.countryCode || persisted.countryCode,
            countryName: prev.countryName || persisted.countryName,
            resultLabel: prev.resultLabel ?? persisted.resultLabel,
          }
        : prev,
    );
  }, [latestScoreQuery.data, liveScore]);

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
        const pilot = payload.pilot;
        setCurrentPilotId(score.pilotId);
        setLiveScore((prev) => ({
          pilotId: score.pilotId,
          pilotNumber: pilot?.pilotNumber ?? prev?.pilotNumber ?? 0,
          firstName: pilot?.firstName ?? prev?.firstName ?? '',
          lastName: pilot?.lastName ?? prev?.lastName ?? '',
          countryCode: pilot?.countryCode ?? pilot?.country ?? prev?.countryCode ?? '',
          countryName: prev?.countryName ?? null,
          scoreCm: score.finalScoreCm,
          isBullseye: score.isBullseye,
          resultLabel:
            score.resultType !== 'MEASURED' && score.resultType !== 'BULLSEYE'
              ? score.resultType
              : undefined,
          roundNumber: prev?.roundNumber ?? 0,
        }));
        refresh();
      }),
      onSocketEvent('ranking:updated', () => refresh()),
      onSocketEvent('wind:updated', (payload) => {
        if (payload.competitionId !== compId) return;
        setWind({ directionDeg: payload.directionDeg, speedMs: payload.speedMs });
      }),
    ];

    return () => {
      unsubs.forEach((u) => u());
      disconnectSocket();
    };
  }, [competitionQuery.data?.id, refresh]);

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

  const lastScorePilotId = liveScore?.pilotId ?? currentPilotId;

  const currentPilot = useMemo((): PublicRankingRow | null => {
    const rankings = resultsQuery.data?.rankings ?? [];
    const find = (id: string | null | undefined) => {
      if (!id) return null;
      return rankings.find((r) => r.id === id || r.pilotId === id) ?? null;
    };

    const fromLastScore = find(lastScorePilotId);
    if (fromLastScore) return fromLastScore;

    if (liveScore) {
      return {
        id: liveScore.pilotId,
        pilotId: liveScore.pilotId,
        rank: 0,
        totalScoreCm: liveScore.scoreCm ?? 0,
        bullseyes: liveScore.isBullseye ? 1 : 0,
        pilot: {
          pilotNumber: liveScore.pilotNumber,
          firstName: liveScore.firstName,
          lastName: liveScore.lastName,
          country: {
            name: liveScore.countryName ?? liveScore.countryCode,
            code: liveScore.countryCode || 'XX',
          },
        },
      };
    }

    return find(currentPilotId);
  }, [resultsQuery.data?.rankings, lastScorePilotId, liveScore, currentPilotId]);

  return {
    competition: competitionQuery.data,
    currentPilot,
    latestScoreCm: liveScore?.scoreCm ?? null,
    isBullseye: liveScore?.isBullseye ?? false,
    resultLabel: liveScore?.resultLabel,
    hasLastScore: Boolean(liveScore),
    wind,
    rankToasts,
    isLoading: Boolean(competitionKey) && competitionQuery.isLoading,
  };
}

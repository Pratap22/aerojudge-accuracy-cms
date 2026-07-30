import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useCallback } from 'react';
import type { ComputedScore } from '@npha/shared';
import { fetchCompetition, fetchResults, getCompetitionSlug } from '../lib/api';
import { connectAnnouncerSocket, disconnectSocket, onSocketEvent } from '../lib/socket';
import type { Announcement, LiveScoreEvent, WindData } from '../lib/types';
import { pilotFullName } from '../lib/utils';
import type { PublicRankingRow, PublicResults } from '../lib/types';

export function useAnnouncerData() {
  const slug = getCompetitionSlug();
  const queryClient = useQueryClient();

  const [currentPilotId, setCurrentPilotId] = useState<string | null>(null);
  const [latestScore, setLatestScore] = useState<LiveScoreEvent | null>(null);
  const [wind, setWind] = useState<WindData | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [previousPilotId, setPreviousPilotId] = useState<string | null>(null);

  const competitionQuery = useQuery({
    queryKey: ['competition', slug],
    queryFn: () => fetchCompetition(slug),
  });

  const resultsQuery = useQuery({
    queryKey: ['results', slug],
    queryFn: () => fetchResults(slug),
    staleTime: 10_000,
  });

  const refreshResults = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['results', slug] });
  }, [queryClient, slug]);

  useEffect(() => {
    const compId = competitionQuery.data?.id;
    if (!compId) return;

    connectAnnouncerSocket(compId);

    const unsubs = [
      onSocketEvent('pilot:current', (payload) => {
        if (payload.competitionId !== compId) return;
        setPreviousPilotId((prev) => (payload.pilotId !== prev ? currentPilotId : prev));
        setCurrentPilotId(payload.pilotId);
      }),
      onSocketEvent('score:updated', (payload) => {
        if (payload.competitionId !== compId) return;
        const score = payload.score as ComputedScore;
        setLatestScore({
          pilotId: score.pilotId,
          pilotNumber: 0,
          pilotName: '',
          scoreCm: score.finalScoreCm,
          isBullseye: score.isBullseye,
          resultLabel: score.resultType !== 'MEASURED' && score.resultType !== 'BULLSEYE'
            ? score.resultType
            : undefined,
          rank: 0,
        });
        refreshResults();
      }),
      onSocketEvent('ranking:updated', () => refreshResults()),
      onSocketEvent('wind:updated', (payload) => {
        if (payload.competitionId !== compId) return;
        setWind({ directionDeg: payload.directionDeg, speedMs: payload.speedMs });
      }),
      onSocketEvent('announcement:new', (payload) => {
        if (payload.competitionId !== compId) return;
        setAnnouncements((prev) => [
          {
            id: crypto.randomUUID(),
            title: payload.title,
            body: payload.body,
            priority: payload.priority as Announcement['priority'],
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      }),
    ];

    return () => {
      unsubs.forEach((u) => u());
      disconnectSocket();
    };
  }, [competitionQuery.data?.id, currentPilotId, refreshResults]);

  const findPilot = (id: string | null, rankings: PublicRankingRow[]): PublicRankingRow | null => {
    if (!id || !rankings.length) return null;
    return rankings.find((r) => r.id === id) ?? null;
  };

  const rankings = resultsQuery.data?.rankings ?? [];
  const currentPilot = findPilot(currentPilotId, rankings) ?? rankings[0] ?? null;
  const previousPilot = findPilot(previousPilotId, rankings);
  const currentIdx = currentPilot ? rankings.findIndex((r) => r.id === currentPilot.id) : -1;
  const nextPilot = currentIdx >= 0 ? rankings[currentIdx + 1] ?? null : rankings[1] ?? null;

  const stats = computeAnnouncerStats(resultsQuery.data);

  const addAnnouncement = (title: string, body: string, priority: Announcement['priority']) => {
    setAnnouncements((prev) => [
      {
        id: crypto.randomUUID(),
        title,
        body,
        priority,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  return {
    competition: competitionQuery.data,
    isLoading: competitionQuery.isLoading || resultsQuery.isLoading,
    currentPilot,
    previousPilot,
    nextPilot,
    latestScore,
    wind,
    announcements,
    stats,
    addAnnouncement,
    refreshResults,
  };
}

function computeAnnouncerStats(results: PublicResults | undefined) {
  if (!results?.rankings.length) {
    return { bullseyesToday: 0, closestToBullseye: null, totalPilots: 0, roundsFlown: 0 };
  }

  const rankings = results.rankings;
  const totalBullseyes = rankings.reduce((s, r) => s + r.bullseyes, 0);
  const closest = rankings.reduce(
    (best, r) => (r.totalScoreCm < (best?.totalScoreCm ?? Infinity) ? r : best),
    rankings[0],
  );

  return {
    bullseyesToday: totalBullseyes,
    closestToBullseye: closest
      ? {
          name: pilotFullName(closest.pilot.firstName, closest.pilot.lastName),
          scoreCm: closest.totalScoreCm,
        }
      : null,
    totalPilots: rankings.length,
    roundsFlown: Math.max(...rankings.map((r) => r.roundsFlown), 0),
  };
}

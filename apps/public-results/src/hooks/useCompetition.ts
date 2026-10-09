import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import type { RankingCategory } from '@aero-judge/shared';
import { fetchCompetition, fetchFeed, fetchLatestWind, fetchResults, fetchRoundsStatus } from '../lib/api';
import { connectPublicSocket, disconnectSocket, onSocketEvent, onSocketReconnect } from '../lib/socket';
import type { PublicResults } from '../lib/types';

export function useSlug(): string {
  const { competitionId } = useParams<{ competitionId: string }>();
  return (competitionId ?? '').trim();
}

export function useCompetition() {
  const slug = useSlug();
  return useQuery({
    queryKey: ['competition', slug],
    queryFn: () => fetchCompetition(slug),
    staleTime: 60_000,
    enabled: Boolean(slug),
  });
}

export function useResults(category: RankingCategory = 'OVERALL') {
  const slug = useSlug();
  const { data: competition } = useCompetition();
  const queryClient = useQueryClient();
  const roomKey = competition?.id ?? slug;

  const query = useQuery({
    queryKey: ['results', slug, category],
    queryFn: () => fetchResults(slug, category),
    staleTime: 10_000,
    enabled: Boolean(slug),
  });

  useEffect(() => {
    if (!roomKey) return;
    connectPublicSocket(roomKey);

    const unsubs = [
      onSocketEvent('ranking:updated', () => {
        queryClient.invalidateQueries({ queryKey: ['results', slug] });
      }),
      onSocketEvent('results:published', () => {
        queryClient.invalidateQueries({ queryKey: ['results', slug] });
      }),
      onSocketEvent('score:updated', () => {
        queryClient.invalidateQueries({ queryKey: ['results', slug] });
      }),
      onSocketEvent('competition:status', () => {
        queryClient.invalidateQueries({ queryKey: ['competition', slug] });
        queryClient.invalidateQueries({ queryKey: ['results', slug] });
      }),
      onSocketEvent('sync:required', () => {
        queryClient.invalidateQueries({ queryKey: ['competition', slug] });
        queryClient.invalidateQueries({ queryKey: ['results', slug] });
      }),
      onSocketReconnect(() => {
        void queryClient.invalidateQueries({ queryKey: ['competition', slug] });
        void queryClient.invalidateQueries({ queryKey: ['results', slug] });
      }),
    ];

    return () => {
      unsubs.forEach((u) => u());
      disconnectSocket();
    };
  }, [roomKey, slug, queryClient]);

  return query;
}

export function useRoundsStatus() {
  const slug = useSlug();
  const { data: competition } = useCompetition();
  const queryClient = useQueryClient();
  const roomKey = competition?.id ?? slug;

  const query = useQuery({
    queryKey: ['public-rounds', slug],
    queryFn: () => fetchRoundsStatus(slug),
    enabled: Boolean(slug),
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!roomKey) return;
    connectPublicSocket(roomKey);
    const unsub = onSocketEvent('round:status', (payload) => {
      if (payload.competitionId !== roomKey && payload.competitionId !== slug) return;
      void queryClient.invalidateQueries({ queryKey: ['public-rounds', slug] });
    });
    const unsubReconnect = onSocketReconnect(() => {
      void queryClient.invalidateQueries({ queryKey: ['public-rounds', slug] });
    });
    return () => {
      unsub();
      unsubReconnect();
    };
  }, [roomKey, slug, queryClient]);

  const pausedRound =
    query.data?.rounds
      .filter((round) => round.status === 'PAUSED')
      .sort((a, b) => b.number - a.number)[0] ?? null;

  return { ...query, pausedRound };
}

export function useEventFeed() {
  const slug = useSlug();
  const { data: competition } = useCompetition();
  const queryClient = useQueryClient();
  const roomKey = competition?.id ?? slug;

  const query = useQuery({
    queryKey: ['event-feed', slug],
    queryFn: () => fetchFeed(slug),
    enabled: Boolean(slug),
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!roomKey) return;
    connectPublicSocket(roomKey);
    const unsub = onSocketEvent('feed:updated', (payload) => {
      if (payload.competitionId !== roomKey && payload.competitionId !== slug) return;
      void queryClient.invalidateQueries({ queryKey: ['event-feed', slug] });
    });
    const unsubReconnect = onSocketReconnect(() => {
      void queryClient.invalidateQueries({ queryKey: ['event-feed', slug] });
    });
    return () => {
      unsub();
      unsubReconnect();
    };
  }, [roomKey, slug, queryClient]);

  return query;
}

export function useLatestWind() {
  const slug = useSlug();
  const { data: competition } = useCompetition();
  const queryClient = useQueryClient();
  const roomKey = competition?.id ?? slug;

  const query = useQuery({
    queryKey: ['wind', slug],
    queryFn: () => fetchLatestWind(slug),
    enabled: Boolean(slug),
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!roomKey) return;
    connectPublicSocket(roomKey);
    const unsubReconnect = onSocketReconnect(() => {
      void queryClient.invalidateQueries({ queryKey: ['wind', slug] });
    });
    const unsub = onSocketEvent('wind:updated', (payload) => {
      if (payload.competitionId !== roomKey && payload.competitionId !== slug) return;
      queryClient.setQueryData(['wind', slug], {
        speedMs: payload.speedMs,
        directionDeg: payload.directionDeg,
        gustMs: null,
        recordedAt: payload.recordedAt ?? new Date().toISOString(),
      });
    });
    return () => {
      unsub();
      unsubReconnect();
    };
  }, [roomKey, slug, queryClient]);

  return query;
}

export function toLeaderboardEntries(results: PublicResults | undefined) {
  if (!results?.rankings) return [];
  const category = results.category;
  const roundsTotal = results.scoringRounds;

  return results.rankings
    .filter((row) => {
      if (category === 'TEAM') return Boolean(row?.team);
      if (category === 'COUNTRY') return Boolean(row?.country) && (row.roundsFlown ?? 0) > 0;
      // Hide pilots who have not scored yet (provisional max-only totals).
      return Boolean(row?.pilot) && (row.roundsFlown ?? 0) > 0;
    })
    .map((row) => {
      if (category === 'TEAM' && row.team) {
        return {
          rank: row.rank,
          pilotNumber: 0,
          firstName: row.team.name,
          lastName: '',
          displayName: row.team.name,
          hideNumber: true,
          countryCode2: row.team.country?.code || undefined,
          totalScoreCm: row.totalScoreCm,
          roundsFlown: row.roundsFlown,
          roundsTotal,
          bullseyes: row.bullseyes,
        };
      }

      if (category === 'COUNTRY' && row.country) {
        return {
          rank: row.rank,
          pilotNumber: 0,
          firstName: row.country.name,
          lastName: '',
          displayName: row.country.name,
          hideNumber: true,
          countryCode2: row.country.code || undefined,
          totalScoreCm: row.totalScoreCm,
          roundsFlown: row.roundsFlown,
          roundsTotal,
          bullseyes: row.bullseyes,
        };
      }

      return {
        rank: row.rank,
        pilotNumber: row.pilot?.pilotNumber ?? 0,
        firstName: row.pilot?.firstName ?? '',
        lastName: row.pilot?.lastName ?? '',
        countryCode2: row.pilot?.country?.code2 || row.pilot?.country?.code || undefined,
        countryName: row.pilot?.country?.name || row.pilot?.nationality || undefined,
        totalScoreCm: row.totalScoreCm,
        roundsFlown: row.roundsFlown,
        roundsTotal,
        bullseyes: row.bullseyes,
        photoUrl: row.pilot?.photoUrl ?? undefined,
        roundScores: (row.roundScores ?? []).map((rs) => ({
          round: rs.round,
          scoreCm: rs.scoreCm,
          isBullseye: rs.isBullseye,
          isDiscarded: rs.isDiscarded,
          isProvisional: rs.isProvisional,
        })),
      };
    });
}

export function computeStats(results: PublicResults | undefined) {
  if (!results?.rankings.length) {
    return {
      totalPilots: 0,
      totalBullseyes: 0,
      averageScoreCm: 0,
      bestScoreCm: 0,
      roundsCompleted: 0,
      countriesRepresented: 0,
    };
  }

  const rankings = results.rankings;
  const countries = new Set(
    rankings
      .map(
        (r) =>
          r.pilot?.country?.code ??
          r.pilot?.nationality ??
          r.team?.country?.code ??
          r.country?.code,
      )
      .filter(Boolean),
  );

  return {
    totalPilots: rankings.length,
    totalBullseyes: rankings.reduce((sum, r) => sum + (r.bullseyes ?? 0), 0),
    averageScoreCm: rankings.reduce((sum, r) => sum + r.totalScoreCm, 0) / rankings.length,
    bestScoreCm: Math.min(...rankings.map((r) => r.totalScoreCm)),
    // Prefer official scoring-round count over max flown (which may lag until recalculate)
    roundsCompleted: results.scoringRounds ?? Math.max(...rankings.map((r) => r.roundsFlown), 0),
    countriesRepresented: countries.size,
  };
}

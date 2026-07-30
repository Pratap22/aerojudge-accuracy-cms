import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import type { RankingCategory } from '@npha/shared';
import { fetchCompetition, fetchResults } from '../lib/api';
import { connectPublicSocket, disconnectSocket, onSocketEvent } from '../lib/socket';
import type { PublicResults } from '../lib/types';

export function useSlug(): string {
  const { slug } = useParams<{ slug: string }>();
  return slug ?? import.meta.env.VITE_DEFAULT_SLUG ?? 'npha-acc-2024';
}

export function useCompetition() {
  const slug = useSlug();
  return useQuery({
    queryKey: ['competition', slug],
    queryFn: () => fetchCompetition(slug),
    staleTime: 60_000,
  });
}

export function useResults(category: RankingCategory = 'OVERALL') {
  const slug = useSlug();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['results', slug, category],
    queryFn: () => fetchResults(slug, category),
    staleTime: 10_000,
  });

  useEffect(() => {
    connectPublicSocket(slug);

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
    ];

    return () => {
      unsubs.forEach((u) => u());
      disconnectSocket();
    };
  }, [slug, queryClient]);

  return query;
}

export function toLeaderboardEntries(results: PublicResults | undefined) {
  if (!results?.rankings) return [];
  const category = results.category;

  return results.rankings
    .filter((row) => {
      if (category === 'TEAM') return Boolean(row?.team);
      if (category === 'COUNTRY') return Boolean(row?.country);
      return Boolean(row?.pilot);
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
          countryCode2: row.team.country?.code ?? 'XX',
          totalScoreCm: row.totalScoreCm,
          roundsFlown: row.roundsFlown,
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
          countryCode2: row.country.code ?? 'XX',
          totalScoreCm: row.totalScoreCm,
          roundsFlown: row.roundsFlown,
          bullseyes: row.bullseyes,
        };
      }

      return {
        rank: row.rank,
        pilotNumber: row.pilot?.pilotNumber ?? 0,
        firstName: row.pilot?.firstName ?? '',
        lastName: row.pilot?.lastName ?? '',
        countryCode2: row.pilot?.country?.code ?? row.pilot?.nationality ?? 'XX',
        totalScoreCm: row.totalScoreCm,
        roundsFlown: row.roundsFlown,
        bullseyes: row.bullseyes,
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
    roundsCompleted: Math.max(...rankings.map((r) => r.roundsFlown), 0),
    countriesRepresented: countries.size,
  };
}

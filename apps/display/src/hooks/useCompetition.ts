import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { RankingCategory } from '@npha/shared';
import { fetchCompetition, fetchResults, getCompetitionSlug } from '../lib/api';
import type { PublicResults } from '../lib/types';

export function useCompetitionSlug(): string {
  return getCompetitionSlug();
}

export function useCompetition() {
  const slug = useCompetitionSlug();
  return useQuery({
    queryKey: ['competition', slug],
    queryFn: () => fetchCompetition(slug),
    staleTime: 60_000,
  });
}

export function useResults(category: RankingCategory = 'OVERALL') {
  const slug = useCompetitionSlug();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['results', slug, category],
    queryFn: () => fetchResults(slug, category),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['results', slug] });
  };

  return { ...query, invalidate };
}

export function toLeaderboardEntries(results: PublicResults | undefined) {
  if (!results?.rankings) return [];
  return results.rankings.map((row) => ({
    rank: row.rank,
    pilotNumber: row.pilot.pilotNumber,
    firstName: row.pilot.firstName,
    lastName: row.pilot.lastName,
    countryCode2: row.pilot.country.code,
    totalScoreCm: row.totalScoreCm,
    roundsFlown: row.roundsFlown,
    bullseyes: row.bullseyes,
  }));
}

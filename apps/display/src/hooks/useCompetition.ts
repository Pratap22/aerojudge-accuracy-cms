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

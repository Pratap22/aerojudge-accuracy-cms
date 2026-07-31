import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import type { RankingCategory } from '@npha/shared';
import { fetchCompetition, fetchLatestScore, fetchResults, fetchRoundsStatus } from '../lib/api';
import type { PublicResults } from '../lib/types';

export function useCompetitionId(): string {
  const { competitionId } = useParams<{ competitionId: string }>();
  return (competitionId ?? '').trim();
}

export function useCompetition() {
  const competitionId = useCompetitionId();
  return useQuery({
    queryKey: ['competition', competitionId],
    queryFn: () => fetchCompetition(competitionId),
    staleTime: 60_000,
    enabled: Boolean(competitionId),
  });
}

export function useLatestScore() {
  const competitionId = useCompetitionId();
  return useQuery({
    queryKey: ['latest-score', competitionId],
    queryFn: () => fetchLatestScore(competitionId),
    staleTime: 5_000,
    enabled: Boolean(competitionId),
  });
}

export function useRoundsStatus() {
  const competitionId = useCompetitionId();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['rounds-status', competitionId],
    queryFn: () => fetchRoundsStatus(competitionId),
    staleTime: 5_000,
    refetchInterval: 15_000,
    enabled: Boolean(competitionId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['rounds-status', competitionId] });
  };

  return { ...query, invalidate };
}

export function useResults(category: RankingCategory = 'OVERALL') {
  const competitionId = useCompetitionId();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['results', competitionId, category],
    queryFn: () => fetchResults(competitionId, category),
    staleTime: 10_000,
    refetchInterval: 30_000,
    enabled: Boolean(competitionId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['results', competitionId] });
    queryClient.invalidateQueries({ queryKey: ['latest-score', competitionId] });
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
          bullseyes: row.bullseyes,
        };
      }

      return {
        rank: row.rank,
        pilotNumber: row.pilot?.pilotNumber ?? 0,
        firstName: row.pilot?.firstName ?? '',
        lastName: row.pilot?.lastName ?? '',
        countryCode2: row.pilot?.country?.code || row.pilot?.nationality || undefined,
        totalScoreCm: row.totalScoreCm,
        roundsFlown: row.roundsFlown,
        bullseyes: row.bullseyes,
      };
    });
}

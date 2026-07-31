import type { ApiResponse, RankingCategory } from '@npha/shared';
import { API_VERSION } from '@npha/shared';
import type { PublicCompetition, PublicCompetitionList, PublicResults } from './types';

async function publicFetch<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(`/api/${API_VERSION}/public${path}`, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
  }
  const response = await fetch(url);
  const json = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !json.success || json.data === undefined) {
    throw new Error(json.error?.message ?? `Request failed (${response.status})`);
  }
  return json.data;
}

export function competitionPath(competitionId: string): string {
  return `/competition/${competitionId}`;
}

export function fetchCompetitions(): Promise<PublicCompetitionList> {
  return publicFetch<PublicCompetitionList>('/competitions');
}

export function fetchCompetition(idOrSlug: string): Promise<PublicCompetition> {
  return publicFetch<PublicCompetition>(`/${idOrSlug}`);
}

export function fetchResults(
  idOrSlug: string,
  category: RankingCategory = 'OVERALL',
): Promise<PublicResults> {
  return publicFetch<PublicResults>(`/${idOrSlug}/results`, { category });
}

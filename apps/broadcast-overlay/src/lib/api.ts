import type { ApiResponse, RankingCategory } from '@npha/shared';
import { API_VERSION } from '@npha/shared';
import type { PublicCompetition, PublicResults } from './types';

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

export function getCompetitionSlug(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('competition') ?? import.meta.env.VITE_COMPETITION_SLUG ?? 'npha-acc-2024';
}

export function fetchCompetition(slug: string): Promise<PublicCompetition> {
  return publicFetch<PublicCompetition>(`/${slug}`);
}

export function fetchResults(slug: string, category: RankingCategory = 'OVERALL'): Promise<PublicResults> {
  return publicFetch<PublicResults>(`/${slug}/results`, { category });
}

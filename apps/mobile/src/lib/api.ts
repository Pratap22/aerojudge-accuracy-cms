import type { RankingCategory } from '@aero-judge/shared';
import { ApiError, publicApiUrl, readApiData, resolveApiBaseUrl } from './public-api';
import type { PublicCompetition, PublicCompetitionList, PublicResults } from './types';

/** Origin used by the running app. Set `EXPO_PUBLIC_API_URL` in `.env` or EAS. */
export function apiBaseUrl(): string {
  return resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_URL);
}

async function fetchPublic<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = publicApiUrl(apiBaseUrl(), path, params);
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new ApiError(0, 'You appear to be offline, or the server cannot be reached.');
  }

  const body: unknown = await response.json().catch(() => null);
  return readApiData<T>(response.status, body);
}

export function fetchCompetitions(): Promise<PublicCompetitionList> {
  return fetchPublic<PublicCompetitionList>('/competitions');
}

export function fetchCompetition(idOrSlug: string): Promise<PublicCompetition> {
  return fetchPublic<PublicCompetition>(`/${encodeURIComponent(idOrSlug)}`);
}

export function fetchResults(idOrSlug: string, category: RankingCategory): Promise<PublicResults> {
  return fetchPublic<PublicResults>(`/${encodeURIComponent(idOrSlug)}/results`, { category });
}

import type {
  ApiResponse,
  AuthenticatedPilotRegistrationInput,
  RankingCategory,
} from '@npha/shared';
import { API_VERSION } from '@npha/shared';
import { getAccessToken } from './auth-api';
import type { PublicCompetition, PublicCompetitionList, PublicResults, RoundResults } from './types';

async function publicFetch<T>(
  path: string,
  params?: Record<string, string | number>,
  init?: RequestInit,
): Promise<T> {
  const url = new URL(`/api/${API_VERSION}/public${path}`, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
  }

  const headers = new Headers(init?.headers);
  const token = getAccessToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, { ...init, headers });
  const json = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !json.success || json.data === undefined) {
    throw new Error(json.error?.message ?? `Request failed (${response.status})`);
  }

  return json.data;
}

export function competitionPath(competitionId: string, ...segments: string[]): string {
  const base = `/competition/${competitionId}`;
  return segments.length ? `${base}/${segments.join('/')}` : base;
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

export function fetchRoundResults(idOrSlug: string, round: number): Promise<RoundResults> {
  return publicFetch<RoundResults>(`/${idOrSlug}/rounds`, { round });
}

export interface PublicCountry {
  id: string;
  code: string;
  code2: string;
  name: string;
}

export function fetchCountries(): Promise<PublicCountry[]> {
  return publicFetch<PublicCountry[]>('/countries');
}

export interface PublicPilotListItem {
  id: string;
  pilotNumber: number;
  firstName: string;
  lastName: string;
  gender: string;
  nationality: string | null;
  club: string | null;
  glider: string | null;
  status: string;
  isWomen: boolean;
  isJunior: boolean;
  country: { name: string; code: string; code2: string } | null;
}

export interface PublicPilotList {
  competitionId: string;
  competitionName: string;
  registrationOpen: boolean;
  pilots: PublicPilotListItem[];
}

export function fetchPilots(idOrSlug: string): Promise<PublicPilotList> {
  return publicFetch<PublicPilotList>(`/${idOrSlug}/pilots`);
}

export interface PublicOfficial {
  id: string;
  competitionId: string;
  name: string;
  role: string;
  imageUrl: string | null;
  phone: string | null;
  email: string | null;
  displayOrder: number;
  isPublic: boolean;
}

export function fetchOfficials(idOrSlug: string): Promise<PublicOfficial[]> {
  return publicFetch<PublicOfficial[]>(`/${idOrSlug}/officials`);
}

export interface RegisteredPilot {
  id: string;
  pilotNumber: number;
  firstName: string;
  lastName: string;
  gender: string;
  nationality: string | null;
  club: string | null;
  glider: string | null;
  status: string;
  country: { name: string; code: string; code2: string } | null;
  competitionId: string;
  competitionName: string;
}

export function registerPilot(
  idOrSlug: string,
  body: AuthenticatedPilotRegistrationInput,
): Promise<RegisteredPilot> {
  return publicFetch<RegisteredPilot>(`/${idOrSlug}/register`, undefined, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

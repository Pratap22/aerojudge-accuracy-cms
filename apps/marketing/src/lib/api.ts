import { API_VERSION } from './constants';

export type PublicCompetitionSummary = {
  id: string;
  name: string;
  code: string;
  organizer: string;
  venue: string;
  country: string;
  startDate: string;
  endDate: string;
  status: string;
  publicSlug: string;
  pilotCount: number;
  teamCount: number;
  roundCount: number;
  completedRounds: number;
};

export type PublicCompetitionList = {
  active: PublicCompetitionSummary[];
  past: PublicCompetitionSummary[];
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: { message?: string };
};

export async function fetchPublicCompetitions(): Promise<PublicCompetitionList> {
  const response = await fetch(`/api/${API_VERSION}/public/competitions`);
  const json = (await response.json()) as ApiResponse<PublicCompetitionList>;
  if (!response.ok || !json.success || !json.data) {
    throw new Error(json.error?.message ?? `Failed to load competitions (${response.status})`);
  }
  return json.data;
}

/** Public results URL for a competition (local port vs production path). */
export function competitionResultsHref(
  competition: Pick<PublicCompetitionSummary, 'id' | 'publicSlug'>,
): string {
  const slug = competition.publicSlug || competition.id;
  if (import.meta.env.DEV) {
    return `http://localhost:3003/competition/${slug}`;
  }
  return `/results/competition/${slug}`;
}

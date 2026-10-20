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

async function fetchPublic<T>(path: string): Promise<T> {
  const response = await fetch(`/api/${API_VERSION}/public${path}`);
  const json = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !json.success || json.data === undefined) {
    throw new Error(json.error?.message ?? `Failed to load (${response.status})`);
  }
  return json.data;
}

export async function fetchPublicCompetitions(): Promise<PublicCompetitionList> {
  return fetchPublic<PublicCompetitionList>('/competitions');
}

export type PublicBoardRanking = {
  rank: number;
  totalScoreCm: number;
  pilot: {
    pilotNumber: number;
    firstName: string;
    lastName: string;
  } | null;
  roundScores?: { round: number; scoreCm: number | null }[];
};

export type PublicBoard = {
  rankings: PublicBoardRanking[];
};

export type PublicTeamBoard = {
  rankings: {
    rank: number;
    team: { name: string } | null;
    pilots?: { pilotNumber: number }[];
  }[];
};

export type PublicLatestScore = {
  pilotNumber: number;
  roundNumber: number;
  scoreCm: number | null;
} | null;

export function fetchOverallBoard(idOrSlug: string): Promise<PublicBoard> {
  return fetchPublic<PublicBoard>(`/${encodeURIComponent(idOrSlug)}/results?category=OVERALL`);
}

export function fetchTeamBoard(idOrSlug: string): Promise<PublicTeamBoard> {
  return fetchPublic<PublicTeamBoard>(`/${encodeURIComponent(idOrSlug)}/results?category=TEAM`);
}

export function fetchLatestPublicScore(idOrSlug: string): Promise<PublicLatestScore> {
  return fetchPublic(`/${encodeURIComponent(idOrSlug)}/latest-score`);
}

/** Public event URL for a competition (local port vs production path). */
export function competitionResultsHref(
  competition: Pick<PublicCompetitionSummary, 'id' | 'publicSlug'>,
): string {
  const slug = competition.publicSlug || competition.id;
  if (import.meta.env.DEV) {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    return `http://${host}:3003/competition/${slug}`;
  }
  return `/events/competition/${slug}`;
}

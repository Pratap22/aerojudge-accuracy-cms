import type { RankingCategory } from '@aero-judge/shared';

/** Public competition summary from GET /api/v1/public/competitions. */
export interface PublicCompetitionSummary {
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
  pilotCount?: number;
  teamCount?: number;
  roundCount?: number;
}

export interface PublicCompetitionList {
  active: PublicCompetitionSummary[];
  past: PublicCompetitionSummary[];
}

export interface PublicOrganiser {
  name: string;
  logoUrl: string | null;
  role: 'Organiser';
}

/** Public competition from GET /api/v1/public/:idOrSlug. */
export interface PublicCompetition extends PublicCompetitionSummary {
  organiser?: PublicOrganiser | null;
  settings?: {
    livePublicResults: boolean;
  } | null;
}

export interface PublicRankingRow {
  id: string;
  rank: number;
  totalScoreCm: number;
  roundsFlown: number;
  bullseyes: number;
  pilot?: {
    pilotNumber: number;
    firstName: string;
    lastName: string;
    country?: { name: string; code: string; code2?: string } | null;
  } | null;
  team?: {
    id: string;
    name: string;
    country?: { name: string; code: string; code2?: string } | null;
  } | null;
  country?: { name: string; code: string; code2?: string } | null;
}

/** Public standings from GET /api/v1/public/:idOrSlug/results. */
export interface PublicResults {
  competition: PublicCompetition;
  category: string;
  official: boolean;
  publishedAt: string | null;
  rankings: PublicRankingRow[];
}

export const RESULT_CATEGORIES: { id: RankingCategory; label: string }[] = [
  { id: 'OVERALL', label: 'Overall' },
  { id: 'WOMEN', label: 'Women' },
  { id: 'TEAM', label: 'Teams' },
  { id: 'COUNTRY', label: 'Countries' },
];

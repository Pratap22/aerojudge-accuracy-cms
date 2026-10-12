export interface PublicCompetition {
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
  settings?: {
    livePublicResults: boolean;
    partnersLabel?: string;
    partnerTiersEnabled?: boolean;
    /** Minutes before a wind reading is hidden. 0 keeps the latest reading visible. */
    windDisplayMaxAgeMinutes?: number;
  };
  pilotCount?: number;
  teamCount?: number;
  roundCount?: number;
}

export type PublicCompetitionSummary = Omit<PublicCompetition, 'settings'>;

export interface PublicCompetitionList {
  active: PublicCompetitionSummary[];
  past: PublicCompetitionSummary[];
}

export interface PublicPilot {
  pilotNumber: number;
  firstName: string;
  lastName: string;
  nationality?: string | null;
  photoUrl?: string | null;
  country?: { name: string; code: string; code2?: string } | null;
}

export interface PublicTeam {
  id: string;
  name: string;
  country?: { name: string; code: string; code2?: string } | null;
}

export interface PublicTeamPilot {
  pilotId: string;
  pilotNumber: number;
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  role?: string;
}

export interface PublicRoundScore {
  round: number;
  scoreCm: number | null;
  isProvisional?: boolean;
  resultType?: string;
}

export interface PublicRankingRow {
  id: string;
  pilotId?: string;
  teamId?: string;
  countryId?: string;
  rank: number;
  totalScoreCm: number;
  roundsFlown: number;
  bullseyes: number;
  roundScores?: PublicRoundScore[];
  pilot?: PublicPilot | null;
  team?: PublicTeam | null;
  /** Team rows only: roster in team order */
  pilots?: PublicTeamPilot[];
  country?: { name: string; code: string; code2?: string } | null;
}

export interface PublicResults {
  competition: PublicCompetition;
  category: string;
  official: boolean;
  publishedAt: string | null;
  rankings: PublicRankingRow[];
  payload: unknown;
}

export type DisplayLayoutType =
  | 'current'
  | 'top10'
  | 'women'
  | 'teams'
  | 'country'
  | 'next'
  | 'sponsors'
  | 'auto';

export interface LiveScore {
  pilotId: string;
  pilotNumber: number;
  firstName: string;
  lastName: string;
  /** ISO alpha-3 shown as text. */
  countryCode: string;
  /** ISO alpha-2 for the flag only. */
  countryCode2?: string;
  scoreCm: number | null;
  isBullseye: boolean;
  resultLabel?: string;
  roundNumber: number;
  rank: number;
  previousRank?: number;
}

export interface WindData {
  directionDeg: number;
  speedMs: number;
  recordedAt?: string;
}

export interface Sponsor {
  id: string;
  name: string;
  type?: string | null;
  logoUrl?: string | null;
  websiteUrl?: string | null;
  tagline?: string;
}

export const DEFAULT_SPONSORS: Sponsor[] = [];

export const AUTO_LAYOUT_SEQUENCE: DisplayLayoutType[] = [
  'current',
  'top10',
  'next',
  'women',
  'teams',
  'country',
  'sponsors',
];

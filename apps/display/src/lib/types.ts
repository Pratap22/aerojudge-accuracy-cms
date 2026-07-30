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
  settings?: { livePublicResults: boolean };
}

export interface PublicPilot {
  pilotNumber: number;
  firstName: string;
  lastName: string;
  nationality?: string | null;
  country?: { name: string; code: string } | null;
}

export interface PublicRankingRow {
  id: string;
  pilotId?: string;
  rank: number;
  totalScoreCm: number;
  roundsFlown: number;
  bullseyes: number;
  pilot: PublicPilot;
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
  countryCode: string;
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
}

export interface Sponsor {
  id: string;
  name: string;
  logoUrl?: string;
  tagline?: string;
}

export const DEFAULT_SPONSORS: Sponsor[] = [
  { id: '1', name: 'NPHA', tagline: 'Nepal Paragliding & Hang Gliding Association' },
  { id: '2', name: 'FAI', tagline: 'World Air Sports Federation' },
  { id: '3', name: 'Nepal Tourism Board', tagline: 'Naturally Nepal' },
  { id: '4', name: 'Sky Sports Nepal', tagline: 'Fly Higher' },
];

export const AUTO_LAYOUT_SEQUENCE: DisplayLayoutType[] = [
  'current',
  'top10',
  'next',
  'women',
  'teams',
  'country',
  'sponsors',
];

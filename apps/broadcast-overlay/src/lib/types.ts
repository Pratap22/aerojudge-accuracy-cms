export interface PublicCompetition {
  id: string;
  name: string;
  code: string;
  publicSlug: string;
}

export interface PublicPilot {
  pilotNumber: number;
  firstName: string;
  lastName: string;
  country: { name: string; code: string };
}

export interface PublicRankingRow {
  id: string;
  rank: number;
  totalScoreCm: number;
  bullseyes: number;
  pilot: PublicPilot;
}

export interface PublicResults {
  competition: PublicCompetition;
  rankings: PublicRankingRow[];
}

export interface WindData {
  directionDeg: number;
  speedMs: number;
}

export interface RankChangeToast {
  id: string;
  pilotName: string;
  pilotNumber: number;
  oldRank: number;
  newRank: number;
}

export interface Sponsor {
  id: string;
  name: string;
}

export const DEFAULT_SPONSORS: Sponsor[] = [
  { id: '1', name: 'NPHA' },
  { id: '2', name: 'FAI' },
  { id: '3', name: 'Nepal Tourism Board' },
];

export type OverlayWidget = 'lowerthird' | 'scorebug' | 'wind' | 'sponsors' | 'countdown';

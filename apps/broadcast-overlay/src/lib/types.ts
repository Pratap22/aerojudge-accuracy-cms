export interface PublicCompetition {
  id: string;
  name: string;
  code: string;
  organizer?: string;
  venue?: string;
  country?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  publicSlug: string;
}

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
}

export interface PublicCompetitionList {
  active: PublicCompetitionSummary[];
  past: PublicCompetitionSummary[];
}

export interface PublicPilot {
  pilotNumber: number;
  firstName: string;
  lastName: string;
  country?: { name: string; code: string } | null;
}

export interface PublicRankingRow {
  id: string;
  pilotId?: string;
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

export const DEFAULT_SPONSORS: Sponsor[] = [];

export type OverlayWidget = 'lowerthird' | 'scorebug' | 'wind' | 'sponsors' | 'countdown';

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
}

export interface PublicPilot {
  pilotNumber: number;
  firstName: string;
  lastName: string;
  nationality: string;
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

export interface Announcement {
  id: string;
  title: string;
  body: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  createdAt: string;
}

export interface WindData {
  directionDeg: number;
  speedMs: number;
}

export interface LiveScoreEvent {
  pilotId: string;
  pilotNumber: number;
  pilotName: string;
  scoreCm: number | null;
  isBullseye: boolean;
  resultLabel?: string;
  rank: number;
  previousRank?: number;
}

export interface CompetitionStats {
  bullseyesToday: number;
  closestToBullseye: { name: string; scoreCm: number } | null;
  totalPilots: number;
  roundsFlown: number;
}

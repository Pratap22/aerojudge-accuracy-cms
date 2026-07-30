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

export interface RoundScore {
  pilotNumber: number;
  firstName: string;
  lastName: string;
  finalScoreCm: number;
  resultType: string;
  country: { name: string };
}

export interface RoundResults {
  competition: PublicCompetition;
  round: { id: string; number: number; status: string };
  scores: RoundScore[];
}

export interface CompetitionStats {
  totalPilots: number;
  totalBullseyes: number;
  averageScoreCm: number;
  bestScoreCm: number;
  roundsCompleted: number;
  countriesRepresented: number;
}

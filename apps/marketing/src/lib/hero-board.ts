import type { PublicCompetitionList, PublicCompetitionSummary } from './api';

const LIVE_STATUSES = new Set(['OFFICIAL', 'PAUSED', 'PRACTICE']);

export type HeroBoardSource = {
  competition: Pick<PublicCompetitionSummary, 'name' | 'status'>;
  rankings: {
    rank: number;
    totalScoreCm: number;
    pilot: {
      pilotNumber: number;
      firstName: string;
      lastName: string;
      photoUrl?: string | null;
      nationality?: string | null;
      country?: { name?: string; code?: string; code2?: string } | null;
    } | null;
    roundScores?: { round: number; scoreCm: number | null }[];
  }[];
  teams: {
    rank: number;
    name: string;
    pilotNumbers: number[];
  }[];
  latest: { pilotNumber: number; roundNumber: number; scoreCm: number | null } | null;
};

export type HeroBoardRow = {
  rank: number;
  name: string;
  score: string;
  total: string;
  highlight: boolean;
};

export type HeroBoard = {
  competitionName: string;
  title: string;
  pilotLabel: string;
  detail: string;
  scoreLabel: string;
  overallLabel: string;
  rankLabel: string;
  teamLabel: string;
  rows: HeroBoardRow[];
};

function byLatestStart(a: PublicCompetitionSummary, b: PublicCompetitionSummary): number {
  return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
}

/** Live meet first, otherwise the most recent completed public competition. */
export function featuredCompetitionCandidates(list: PublicCompetitionList): PublicCompetitionSummary[] {
  const live = list.active
    .filter((competition) => LIVE_STATUSES.has(competition.status))
    .sort(byLatestStart);
  const completed = list.past
    .filter((competition) => competition.status === 'COMPLETED')
    .sort(byLatestStart);
  const seen = new Set<string>();
  return [...live, ...completed].filter((competition) => {
    if (seen.has(competition.id)) return false;
    seen.add(competition.id);
    return true;
  });
}

function pilotName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.replace(/\s+/g, ' ').trim();
}

export type DisplaySnapshot = {
  competitionName: string;
  pilotName: string;
  pilotNumber: string;
  photoUrl: string | null;
  country: string;
  flag: string;
  roundLabel: string;
  rankLabel: string;
  totalLabel: string;
  scoreLabel: string;
  bullseye: boolean;
};

function padScore(cm: number | null | undefined): string {
  if (cm == null || Number.isNaN(Number(cm))) return '—';
  return String(Math.round(Number(cm))).padStart(3, '0');
}

function flagEmoji(code2: string | undefined): string {
  const upper = code2?.trim().toUpperCase() ?? '';
  if (!/^[A-Z]{2}$/.test(upper) || upper === 'XX') return '';
  return String.fromCodePoint(...upper.split('').map((char) => 127397 + char.charCodeAt(0)));
}

/** Compact venue-display frame: the pilot on screen, in the live board's shape. */
export function buildDisplaySnapshot(source: HeroBoardSource): DisplaySnapshot | null {
  const ranked = source.rankings
    .filter((row) => row.pilot && row.rank > 0)
    .sort((a, b) => a.rank - b.rank);
  if (ranked.length === 0) return null;

  const live = LIVE_STATUSES.has(source.competition.status);
  const featuredFromLatest =
    live && source.latest
      ? ranked.find((row) => row.pilot?.pilotNumber === source.latest?.pilotNumber)
      : undefined;
  const featured = featuredFromLatest ?? ranked[0];
  const pilot = featured.pilot;
  if (!pilot) return null;

  const scoredRounds = (featured.roundScores ?? [])
    .filter((score) => score.scoreCm != null)
    .sort((a, b) => b.round - a.round);
  const roundNumber =
    live && source.latest && featuredFromLatest
      ? source.latest.roundNumber
      : (scoredRounds[0]?.round ?? null);
  const landingScore =
    live && source.latest && featuredFromLatest && source.latest.roundNumber === roundNumber
      ? source.latest.scoreCm
      : (featured.roundScores ?? []).find((score) => score.round === roundNumber)?.scoreCm ?? null;

  const countryCode = pilot.country?.code?.trim().toUpperCase() ?? '';
  const nationality = pilot.nationality?.trim().toUpperCase() ?? '';
  const country = /^[A-Z]{3}$/.test(countryCode)
    ? countryCode
    : /^[A-Z]{3}$/.test(nationality)
      ? nationality
      : '';

  return {
    competitionName: source.competition.name,
    pilotName: pilotName(pilot.firstName, pilot.lastName),
    pilotNumber: String(pilot.pilotNumber).padStart(3, '0'),
    photoUrl: pilot.photoUrl ?? null,
    country,
    flag: flagEmoji(pilot.country?.code2),
    roundLabel: roundNumber != null ? String(roundNumber) : '—',
    rankLabel: `#${featured.rank}`,
    totalLabel: padScore(featured.totalScoreCm),
    scoreLabel: padScore(landingScore),
    bullseye: landingScore === 0,
  };
}

function formatCm(cm: number | null | undefined): string {
  if (cm == null || Number.isNaN(Number(cm))) return '—';
  const value = Number(cm);
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function buildHeroBoard(source: HeroBoardSource): HeroBoard | null {
  const ranked = source.rankings
    .filter((row) => row.pilot && row.rank > 0)
    .sort((a, b) => a.rank - b.rank);
  if (ranked.length === 0) return null;

  const live = LIVE_STATUSES.has(source.competition.status);
  const featuredFromLatest =
    live && source.latest
      ? ranked.find((row) => row.pilot?.pilotNumber === source.latest?.pilotNumber)
      : undefined;
  const featured = featuredFromLatest ?? ranked[0];
  const pilot = featured.pilot;
  if (!pilot) return null;

  const scoredRounds = (featured.roundScores ?? [])
    .filter((score) => score.scoreCm != null)
    .sort((a, b) => b.round - a.round);
  const roundNumber =
    live && source.latest && featuredFromLatest
      ? source.latest.roundNumber
      : (scoredRounds[0]?.round ?? null);

  const landingScore =
    live && source.latest && featuredFromLatest && source.latest.roundNumber === roundNumber
      ? source.latest.scoreCm
      : (featured.roundScores ?? []).find((score) => score.round === roundNumber)?.scoreCm ?? null;

  const team = source.teams.find((item) => item.pilotNumbers.includes(pilot.pilotNumber));
  const detail = [team?.name, roundNumber != null ? `Round ${roundNumber}` : null]
    .filter(Boolean)
    .join(' · ');

  return {
    competitionName: source.competition.name,
    title: `${live ? 'Live' : 'Final'} · Round ${roundNumber ?? '—'}`,
    pilotLabel: `#${pilot.pilotNumber} · ${pilotName(pilot.firstName, pilot.lastName)}`,
    detail,
    scoreLabel: formatCm(landingScore),
    overallLabel: formatCm(featured.totalScoreCm) === '—' ? '—' : `${formatCm(featured.totalScoreCm)} cm`,
    rankLabel: `#${featured.rank}`,
    teamLabel: team ? `#${team.rank}` : '—',
    rows: ranked.slice(0, 3).map((row) => {
      const entry = row.pilot!;
      const cell =
        roundNumber == null
          ? null
          : (row.roundScores ?? []).find((score) => score.round === roundNumber)?.scoreCm ?? null;
      return {
        rank: row.rank,
        name: pilotName(entry.firstName, entry.lastName),
        score: formatCm(cell),
        total: formatCm(row.totalScoreCm),
        highlight: entry.pilotNumber === pilot.pilotNumber,
      };
    }),
  };
}

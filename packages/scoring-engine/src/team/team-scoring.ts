/**
 * FAI Team Scoring Engine – Section 7C
 *
 * Per round: sum of the best N scoring pilots' scores (lower is better).
 * Reserves fill in when a primary scoring pilot is ABS/DNF/withdrawn if configured.
 * Complete audit trail for every calculation.
 */

import type {
  RankingCategory,
  RuleConfig,
  ScoringAuditEntry,
  TeamPilotContribution,
  TeamRankingResult,
  TeamRoundScoreResult,
} from '@npha/shared';

export interface TeamMemberInput {
  pilotId: string;
  role: 'PILOT' | 'RESERVE' | 'CAPTAIN' | 'VICE_CAPTAIN';
  order: number;
}

export interface TeamPilotRoundScore {
  pilotId: string;
  scoreCm: number;
  resultType: string;
  isCountable: boolean;
  status?: string; // pilot competition status
}

export interface TeamInput {
  teamId: string;
  type: string;
  members: TeamMemberInput[];
  scoringPilots?: number;
  maxReserves?: number;
}

function audit(step: string, detail: string, data?: Record<string, unknown>): ScoringAuditEntry {
  return { timestamp: new Date().toISOString(), step, detail, data };
}

/**
 * Calculate a single team's score for one round.
 * Selects the best (lowest) N countable scores from eligible members.
 */
export function calculateTeamRoundScore(
  team: TeamInput,
  roundId: string,
  pilotScores: TeamPilotRoundScore[],
  rules: RuleConfig,
): TeamRoundScoreResult {
  const audits: ScoringAuditEntry[] = [];
  const scoringCount = team.scoringPilots ?? rules.teamScoringPilots;

  audits.push(
    audit('start', `Calculating team round score`, {
      teamId: team.teamId,
      roundId,
      scoringCount,
      memberCount: team.members.length,
    }),
  );

  const scoreByPilot = new Map(pilotScores.map((s) => [s.pilotId, s]));
  const contributions: TeamPilotContribution[] = [];

  for (const member of team.members) {
    const score = scoreByPilot.get(member.pilotId);
    const isReserve = member.role === 'RESERVE';

    if (!score) {
      contributions.push({
        pilotId: member.pilotId,
        scoreCm: rules.maximumScoreCm,
        counted: false,
        reason: 'No score for this round – treated as ABS/maximum for selection',
        isReserve,
      });
      continue;
    }

    if (!score.isCountable || score.resultType === 'REFLIGHT') {
      contributions.push({
        pilotId: member.pilotId,
        scoreCm: score.scoreCm,
        counted: false,
        reason: `Not countable (${score.resultType})`,
        isReserve,
      });
      continue;
    }

    if (score.status === 'WITHDRAWN' || score.status === 'DISQUALIFIED') {
      contributions.push({
        pilotId: member.pilotId,
        scoreCm: rules.maximumScoreCm,
        counted: false,
        reason: `Pilot ${score.status}`,
        isReserve,
      });
      continue;
    }

    contributions.push({
      pilotId: member.pilotId,
      scoreCm: score.scoreCm,
      counted: false, // set below after selection
      reason: 'Eligible for team scoring',
      isReserve,
    });
  }

  // Prefer non-reserve eligible pilots; fill with reserves if needed
  const eligiblePrimaries = contributions
    .filter((c) => c.reason === 'Eligible for team scoring' && !c.isReserve)
    .sort((a, b) => a.scoreCm - b.scoreCm);

  const eligibleReserves = contributions
    .filter((c) => c.reason === 'Eligible for team scoring' && c.isReserve)
    .sort((a, b) => a.scoreCm - b.scoreCm);

  const selected: TeamPilotContribution[] = [];
  for (const c of eligiblePrimaries) {
    if (selected.length >= scoringCount) break;
    selected.push(c);
  }

  if (rules.teamAllowReserves) {
    for (const c of eligibleReserves) {
      if (selected.length >= scoringCount) break;
      selected.push({ ...c, reason: 'Reserve filling scoring slot' });
    }
  }

  // If still short, fill remaining with maximum scores (ABS) from non-selected
  while (selected.length < scoringCount) {
    const filler = contributions.find(
      (c) => !selected.some((s) => s.pilotId === c.pilotId),
    );
    if (!filler) {
      selected.push({
        pilotId: `MISSING_${selected.length}`,
        scoreCm: rules.maximumScoreCm,
        counted: true,
        reason: 'Missing pilot – maximum score applied',
        isReserve: false,
      });
      break;
    }
    selected.push({
      ...filler,
      scoreCm: rules.maximumScoreCm,
      counted: true,
      reason: `Filled vacant slot with maximum (${filler.reason})`,
    });
  }

  const selectedIds = new Set(selected.map((s) => s.pilotId));
  const countedPilots = selected.map((s) => ({ ...s, counted: true }));
  const discardedPilots = contributions
    .filter((c) => !selectedIds.has(c.pilotId))
    .map((c) => ({
      ...c,
      counted: false,
      reason: c.reason === 'Eligible for team scoring' ? 'Not among best scoring pilots' : c.reason,
    }));

  const totalScoreCm = countedPilots.reduce((sum, c) => sum + c.scoreCm, 0);

  audits.push(
    audit('selection', `Selected ${countedPilots.length} scoring pilots`, {
      counted: countedPilots.map((c) => ({
        pilotId: c.pilotId,
        scoreCm: c.scoreCm,
        reason: c.reason,
      })),
      discarded: discardedPilots.map((c) => ({
        pilotId: c.pilotId,
        scoreCm: c.scoreCm,
        reason: c.reason,
      })),
      totalScoreCm,
    }),
  );

  return {
    teamId: team.teamId,
    roundId,
    totalScoreCm,
    countedPilots,
    discardedPilots,
    audit: audits,
  };
}

export function calculateTeamRankings(
  teams: TeamInput[],
  roundScores: TeamRoundScoreResult[],
  _rules: RuleConfig,
  category: RankingCategory = 'OVERALL',
): TeamRankingResult[] {
  const filteredTeams = teams.filter((t) => {
    if (category === 'WOMEN') return t.type === 'WOMEN';
    if (category === 'TEAM') return true;
    return true;
  });

  const byTeam = new Map<string, TeamRoundScoreResult[]>();
  for (const rs of roundScores) {
    const list = byTeam.get(rs.teamId) ?? [];
    list.push(rs);
    byTeam.set(rs.teamId, list);
  }

  const results: TeamRankingResult[] = filteredTeams.map((team) => {
    const scores = byTeam.get(team.teamId) ?? [];
    /** Every contested team round counts — no worst-round drop at team level. */
    const roundsFlown = scores.length;
    // Per-round, worst pilot(s) are already excluded via best-N in calculateTeamRoundScore.
    // Individual "discard worst round" rules do not apply to team overall totals.
    const totalScoreCm = scores.reduce((s, r) => s + r.totalScoreCm, 0);
    const audits: ScoringAuditEntry[] = [
      audit('team-total', `Summed ${roundsFlown} team round score(s) (no round discard)`, {
        teamId: team.teamId,
        totalScoreCm,
        roundsFlown,
        countedRounds: roundsFlown,
        rounds: scores.map((r) => ({ roundId: r.roundId, score: r.totalScoreCm })),
      }),
    ];

    return {
      teamId: team.teamId,
      category,
      rank: 0,
      totalScoreCm,
      roundsScored: roundsFlown,
      tieBreakNotes: '',
      audit: audits,
    };
  });

  results.sort((a, b) => {
    if (a.totalScoreCm !== b.totalScoreCm) return a.totalScoreCm - b.totalScoreCm;
    // Tie-break: more rounds scored, then teamId for stability
    if (a.roundsScored !== b.roundsScored) {
      const winner = a.roundsScored > b.roundsScored ? 'a' : 'b';
      if (winner === 'a') a.tieBreakNotes = 'Tie-break: more rounds scored';
      else b.tieBreakNotes = 'Tie-break: more rounds scored';
      return a.roundsScored > b.roundsScored ? -1 : 1;
    }
    a.tieBreakNotes = 'Unresolved team tie';
    b.tieBreakNotes = 'Unresolved team tie';
    return a.teamId.localeCompare(b.teamId);
  });

  results.forEach((r, i) => {
    r.rank = i + 1;
  });

  return results;
}

export function validateTeamComposition(
  team: TeamInput,
  rules: RuleConfig,
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const maxSize = rules.teamSize;
  const maxReserves = team.maxReserves ?? rules.teamMaxReserves;
  const scoringPilots = team.scoringPilots ?? rules.teamScoringPilots;

  const primaries = team.members.filter((m) => m.role !== 'RESERVE');
  const reserves = team.members.filter((m) => m.role === 'RESERVE');

  if (team.members.length === 0) errors.push('Team has no members');
  if (team.members.length > maxSize + maxReserves) {
    errors.push(`Team exceeds max size ${maxSize} + ${maxReserves} reserves`);
  }
  if (primaries.length < scoringPilots) {
    errors.push(`Need at least ${scoringPilots} primary pilots (have ${primaries.length})`);
  }
  if (reserves.length > maxReserves) {
    errors.push(`Too many reserves: ${reserves.length} > ${maxReserves}`);
  }

  const ids = team.members.map((m) => m.pilotId);
  if (new Set(ids).size !== ids.length) errors.push('Duplicate pilots in team');

  return { isValid: errors.length === 0, errors };
}

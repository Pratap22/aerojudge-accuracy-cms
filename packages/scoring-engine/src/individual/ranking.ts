/**
 * Individual overall ranking – FAI Section 7C
 *
 * Total score = sum of countable round scores (lower is better).
 * Discard rules: after N rounds flown, discard worst M round(s).
 * Tie-breaks applied per configurable priority list.
 */

import type {
  IndividualRankingResult,
  RankingCategory,
  RoundScoreEntry,
  RuleConfig,
  ScoringAuditEntry,
  TieBreakCriterion,
} from '@npha/shared';

export interface PilotRankingInput {
  pilotId: string;
  pilotNumber: number;
  gender?: string;
  isJunior?: boolean;
  isWomen?: boolean;
  countryId?: string | null;
  status?: string;
  roundScores: RoundScoreEntry[];
}

function audit(step: string, detail: string, data?: Record<string, unknown>): ScoringAuditEntry {
  return { timestamp: new Date().toISOString(), step, detail, data };
}

export function applyDiscardRules(
  scores: RoundScoreEntry[],
  rules: RuleConfig,
): { kept: RoundScoreEntry[]; discarded: RoundScoreEntry[]; discardedTotal: number } {
  const countable = scores.filter(
    (s) => !rules.excludeFromRankingTypes.includes(s.resultType),
  );

  if (
    rules.discardWorstRounds <= 0 ||
    countable.length < rules.discardAfterRounds ||
    countable.length <= rules.discardWorstRounds
  ) {
    return {
      kept: countable.map((s) => ({ ...s, isDiscarded: false })),
      discarded: [],
      discardedTotal: 0,
    };
  }

  // Discard the worst (highest) scores
  const sorted = [...countable].sort((a, b) => b.finalScoreCm - a.finalScoreCm);
  const toDiscard = sorted.slice(0, rules.discardWorstRounds);
  const discardIds = new Set(toDiscard.map((s) => `${s.roundId}:${s.pilotId}`));

  const kept: RoundScoreEntry[] = [];
  const discarded: RoundScoreEntry[] = [];

  for (const s of countable) {
    const key = `${s.roundId}:${s.pilotId}`;
    if (discardIds.has(key)) {
      discarded.push({ ...s, isDiscarded: true });
    } else {
      kept.push({ ...s, isDiscarded: false });
    }
  }

  const discardedTotal = discarded.reduce((sum, s) => sum + s.finalScoreCm, 0);
  return { kept, discarded, discardedTotal };
}

/**
 * For each countable round, pilots without a score receive DNF at maximumScoreCm.
 * Used so incomplete rounds still contribute correctly to totals (FAI Section 7C).
 */
export function fillMissingRoundScoresAsDnf(
  pilots: PilotRankingInput[],
  rounds: Array<{ id: string; number: number }>,
  rules: RuleConfig,
): PilotRankingInput[] {
  if (!rounds.length) return pilots;

  return pilots.map((pilot) => {
    const byRound = new Map(pilot.roundScores.map((s) => [s.roundId, s]));
    const filled: RoundScoreEntry[] = rounds.map((round) => {
      const existing = byRound.get(round.id);
      if (existing) return existing;
      return {
        pilotId: pilot.pilotId,
        roundId: round.id,
        roundNumber: round.number,
        finalScoreCm: rules.maximumScoreCm,
        resultType: 'DNF',
        isBullseye: false,
        isDiscarded: false,
      };
    });
    return { ...pilot, roundScores: filled };
  });
}

export function comparePilotsForTieBreak(
  a: IndividualRankingResult,
  b: IndividualRankingResult,
  aInput: PilotRankingInput,
  bInput: PilotRankingInput,
  criteria: TieBreakCriterion[] | null | undefined,
): { winner: 'a' | 'b' | 'tie'; notes: string } {
  const list = Array.isArray(criteria) && criteria.length > 0 ? criteria : ([
    'MOST_BULLSEYES',
    'BEST_SINGLE_SCORE',
    'BEST_LAST_ROUND',
    'MOST_ROUNDS_FLOWN',
    'LOWEST_DISCARDED',
    'PILOT_NUMBER',
  ] as TieBreakCriterion[]);

  for (const criterion of list) {
    switch (criterion) {
      case 'MOST_BULLSEYES': {
        if (a.bullseyes !== b.bullseyes) {
          return {
            winner: a.bullseyes > b.bullseyes ? 'a' : 'b',
            notes: `Tie-break: most bullseyes (${a.bullseyes} vs ${b.bullseyes})`,
          };
        }
        break;
      }
      case 'BEST_SINGLE_SCORE': {
        const aBest = Math.min(...a.roundScores.filter((s) => !s.isDiscarded).map((s) => s.finalScoreCm), Infinity);
        const bBest = Math.min(...b.roundScores.filter((s) => !s.isDiscarded).map((s) => s.finalScoreCm), Infinity);
        if (aBest !== bBest) {
          return {
            winner: aBest < bBest ? 'a' : 'b',
            notes: `Tie-break: best single score (${aBest} vs ${bBest})`,
          };
        }
        break;
      }
      case 'BEST_LAST_ROUND': {
        const aLast = [...a.roundScores].sort((x, y) => y.roundNumber - x.roundNumber)[0];
        const bLast = [...b.roundScores].sort((x, y) => y.roundNumber - x.roundNumber)[0];
        if (aLast && bLast && aLast.finalScoreCm !== bLast.finalScoreCm) {
          return {
            winner: aLast.finalScoreCm < bLast.finalScoreCm ? 'a' : 'b',
            notes: `Tie-break: best last round (${aLast.finalScoreCm} vs ${bLast.finalScoreCm})`,
          };
        }
        break;
      }
      case 'MOST_ROUNDS_FLOWN': {
        if (a.roundsFlown !== b.roundsFlown) {
          return {
            winner: a.roundsFlown > b.roundsFlown ? 'a' : 'b',
            notes: `Tie-break: most rounds flown (${a.roundsFlown} vs ${b.roundsFlown})`,
          };
        }
        break;
      }
      case 'LOWEST_DISCARDED': {
        const aDisc = a.discardedScoreCm ?? Infinity;
        const bDisc = b.discardedScoreCm ?? Infinity;
        if (aDisc !== bDisc) {
          return {
            winner: aDisc < bDisc ? 'a' : 'b',
            notes: `Tie-break: lowest discarded (${aDisc} vs ${bDisc})`,
          };
        }
        break;
      }
      case 'PILOT_NUMBER': {
        if (aInput.pilotNumber !== bInput.pilotNumber) {
          return {
            winner: aInput.pilotNumber < bInput.pilotNumber ? 'a' : 'b',
            notes: `Tie-break: lower pilot number (${aInput.pilotNumber} vs ${bInput.pilotNumber})`,
          };
        }
        break;
      }
    }
  }
  return { winner: 'tie', notes: 'Unresolved tie after all criteria' };
}

export function calculateIndividualRankings(
  pilots: PilotRankingInput[],
  rules: RuleConfig,
  category: RankingCategory = 'OVERALL',
): IndividualRankingResult[] {
  const filtered = pilots.filter((p) => {
    if (p.status === 'WITHDRAWN' || p.status === 'DISQUALIFIED') {
      // Still rank DSQ pilots with max scores; withdrawn may be excluded
      if (p.status === 'WITHDRAWN') return false;
    }
    if (category === 'WOMEN') return p.isWomen || p.gender === 'FEMALE';
    if (category === 'JUNIOR') return p.isJunior === true;
    return true;
  });

  const results: IndividualRankingResult[] = filtered.map((pilot) => {
    const audits: ScoringAuditEntry[] = [];
    const { kept, discarded, discardedTotal } = applyDiscardRules(pilot.roundScores, rules);

    audits.push(
      audit('discard', `Applied discard rules`, {
        discardWorstRounds: rules.discardWorstRounds,
        discardAfterRounds: rules.discardAfterRounds,
        kept: kept.length,
        discarded: discarded.length,
        discardedTotal,
      }),
    );

    const totalScoreCm = kept.reduce((sum, s) => sum + s.finalScoreCm, 0);
    const bullseyes = kept.filter((s) => s.isBullseye).length;

    return {
      pilotId: pilot.pilotId,
      category,
      rank: 0,
      totalScoreCm,
      roundsFlown: kept.length,
      bullseyes,
      discardedScoreCm: discarded.length ? discardedTotal : null,
      roundScores: [...kept, ...discarded],
      tieBreakNotes: '',
      audit: audits,
    };
  });

  // Sort by total ascending (lower is better), then tie-break
  results.sort((a, b) => {
    if (a.totalScoreCm !== b.totalScoreCm) return a.totalScoreCm - b.totalScoreCm;
    const aInput = filtered.find((p) => p.pilotId === a.pilotId)!;
    const bInput = filtered.find((p) => p.pilotId === b.pilotId)!;
    const tb = comparePilotsForTieBreak(a, b, aInput, bInput, rules.tieBreakPriority);
    if (tb.winner === 'a') {
      a.tieBreakNotes = tb.notes;
      return -1;
    }
    if (tb.winner === 'b') {
      b.tieBreakNotes = tb.notes;
      return 1;
    }
    a.tieBreakNotes = tb.notes;
    b.tieBreakNotes = tb.notes;
    return 0;
  });

  // Assign ranks (dense ranking with ties sharing rank)
  let currentRank = 1;
  for (let i = 0; i < results.length; i++) {
    if (
      i > 0 &&
      (results[i].totalScoreCm !== results[i - 1].totalScoreCm ||
        results[i].tieBreakNotes.includes('Unresolved'))
    ) {
      // Check if truly tied after tie-break
      const prev = results[i - 1];
      const curr = results[i];
      if (prev.totalScoreCm === curr.totalScoreCm && curr.tieBreakNotes.includes('Unresolved')) {
        results[i].rank = prev.rank;
        continue;
      }
      currentRank = i + 1;
    } else if (i > 0 && results[i].totalScoreCm === results[i - 1].totalScoreCm) {
      // Differentiated by tie-break – different ranks
      currentRank = i + 1;
    }
    results[i].rank = currentRank;
  }

  return results;
}

export function calculateCountryRankings(
  pilots: PilotRankingInput[],
  individualRankings: IndividualRankingResult[],
  scoringPilotsPerCountry = 3,
): Array<{
  countryId: string;
  rank: number;
  totalScoreCm: number;
  pilotIds: string[];
  audit: ScoringAuditEntry[];
}> {
  const byCountry = new Map<string, IndividualRankingResult[]>();

  for (const ranking of individualRankings) {
    const pilot = pilots.find((p) => p.pilotId === ranking.pilotId);
    if (!pilot?.countryId) continue;
    const list = byCountry.get(pilot.countryId) ?? [];
    list.push(ranking);
    byCountry.set(pilot.countryId, list);
  }

  const countryResults = [...byCountry.entries()].map(([countryId, rankings]) => {
    const sorted = [...rankings].sort((a, b) => a.totalScoreCm - b.totalScoreCm);
    const counted = sorted.slice(0, scoringPilotsPerCountry);
    const totalScoreCm = counted.reduce((s, r) => s + r.totalScoreCm, 0);
    return {
      countryId,
      rank: 0,
      totalScoreCm,
      pilotIds: counted.map((c) => c.pilotId),
      audit: [
        audit('country', `Counted top ${counted.length} of ${sorted.length} pilots`, {
          countryId,
          totalScoreCm,
          pilotIds: counted.map((c) => c.pilotId),
        }),
      ],
    };
  });

  countryResults.sort((a, b) => a.totalScoreCm - b.totalScoreCm);
  countryResults.forEach((r, i) => {
    r.rank = i + 1;
  });

  return countryResults;
}

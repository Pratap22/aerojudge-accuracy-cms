export * from './rules/profiles';
export * from './individual/flight-score';
export * from './individual/ranking';
export * from './team/team-scoring';
export * from './penalties';

import { computeFlightScore } from './individual/flight-score';
import {
  calculateCountryRankings,
  calculateIndividualRankings,
} from './individual/ranking';
import {
  calculateTeamRankings,
  calculateTeamRoundScore,
  validateTeamComposition,
} from './team/team-scoring';
import { resolveCompetitionRules, validateRuleConfig } from './rules/profiles';

/** Facade used by the API service layer */
export const ScoringEngine = {
  resolveRules: resolveCompetitionRules,
  validateRules: validateRuleConfig,
  computeFlightScore,
  calculateIndividualRankings,
  calculateCountryRankings,
  calculateTeamRoundScore,
  calculateTeamRankings,
  validateTeamComposition,
};

export default ScoringEngine;

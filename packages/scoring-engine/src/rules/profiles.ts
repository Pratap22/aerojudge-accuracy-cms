/**
 * FAI Sporting Code Section 7C – Configurable Rule Profiles
 * Versioned so future FAI / national-local rule changes do not require app rewrites.
 * `NPHA_LOCAL` is a legacy profile key for an example national adaptation (sample customer data).
 */

import {
  DEFAULT_FAI_2022_RULES,
  type RuleConfig,
  type RuleSetVersion,
} from '@npha/shared';

const RULE_PROFILES: Record<RuleSetVersion, RuleConfig> = {
  FAI_2022: { ...DEFAULT_FAI_2022_RULES },

  FAI_FUTURE: {
    ...DEFAULT_FAI_2022_RULES,
    version: 'FAI_FUTURE',
    // Placeholder for future FAI amendments – override via CompetitionSettings.customRulesJson
    discardAfterRounds: 5,
    discardWorstRounds: 1,
  },

  NPHA_LOCAL: {
    ...DEFAULT_FAI_2022_RULES,
    version: 'NPHA_LOCAL',
    maximumScoreCm: 1000,
    teamSize: 4,
    teamScoringPilots: 3,
    juniorMaxAge: 25,
    customRules: {
      // Example national federation metadata for this legacy profile key — not AeroJudge branding
      federation: 'NPHA',
      country: 'Nepal',
      notes: 'Example national/local accuracy rules based on FAI 7C (sample organization: NPHA)',
    },
  },

  CUSTOM: {
    ...DEFAULT_FAI_2022_RULES,
    version: 'CUSTOM',
  },
};

export function getRuleProfile(version: RuleSetVersion): RuleConfig {
  return structuredClone(RULE_PROFILES[version] ?? RULE_PROFILES.FAI_2022);
}

export function mergeRuleConfig(
  base: RuleConfig,
  overrides?: Partial<RuleConfig> | Record<string, unknown> | null,
): RuleConfig {
  if (!overrides) return structuredClone(base);
  return {
    ...base,
    ...overrides,
    customRules: {
      ...(base.customRules ?? {}),
      ...((overrides as RuleConfig).customRules ?? {}),
    },
  } as RuleConfig;
}

export function resolveCompetitionRules(
  version: RuleSetVersion,
  settingsOverrides?: Partial<RuleConfig> | null,
): RuleConfig {
  return mergeRuleConfig(getRuleProfile(version), settingsOverrides ?? undefined);
}

export function validateRuleConfig(config: RuleConfig): string[] {
  const errors: string[] = [];
  if (config.bullseyeScoreCm < 0) errors.push('bullseyeScoreCm must be >= 0');
  if (config.maximumScoreCm <= config.bullseyeScoreCm) {
    errors.push('maximumScoreCm must be greater than bullseyeScoreCm');
  }
  if (config.teamScoringPilots > config.teamSize) {
    errors.push('teamScoringPilots cannot exceed teamSize');
  }
  if (config.discardWorstRounds < 0) errors.push('discardWorstRounds must be >= 0');
  if (config.discardAfterRounds < 0) errors.push('discardAfterRounds must be >= 0');
  return errors;
}

export { RULE_PROFILES };

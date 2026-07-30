/**
 * Penalty application helpers – FAI Section 7C / local rules
 */

import type { RuleConfig } from '@npha/shared';

export type PenaltyKind =
  | 'WARNING'
  | 'DISTANCE_ADD'
  | 'ROUND_MAXIMUM'
  | 'DISQUALIFICATION'
  | 'TECHNICAL'
  | 'BEHAVIOURAL'
  | 'SAFETY'
  | 'OTHER';

export interface PenaltyInput {
  kind: PenaltyKind;
  amountCm?: number;
  reason: string;
  ruleReference?: string;
}

export interface AppliedPenalty {
  kind: PenaltyKind;
  amountCm: number;
  forcesMaximum: boolean;
  forcesDsq: boolean;
  reason: string;
  ruleReference?: string;
}

export function applyPenalty(input: PenaltyInput, rules: RuleConfig): AppliedPenalty {
  switch (input.kind) {
    case 'WARNING':
      return {
        kind: input.kind,
        amountCm: 0,
        forcesMaximum: false,
        forcesDsq: false,
        reason: input.reason,
        ruleReference: input.ruleReference,
      };
    case 'DISTANCE_ADD':
      return {
        kind: input.kind,
        amountCm: Math.max(0, input.amountCm ?? 0),
        forcesMaximum: false,
        forcesDsq: false,
        reason: input.reason,
        ruleReference: input.ruleReference,
      };
    case 'ROUND_MAXIMUM':
      return {
        kind: input.kind,
        amountCm: rules.maximumScoreCm,
        forcesMaximum: true,
        forcesDsq: false,
        reason: input.reason,
        ruleReference: input.ruleReference,
      };
    case 'DISQUALIFICATION':
      return {
        kind: input.kind,
        amountCm: rules.maximumScoreCm,
        forcesMaximum: true,
        forcesDsq: true,
        reason: input.reason,
        ruleReference: input.ruleReference,
      };
    default:
      return {
        kind: input.kind,
        amountCm: Math.max(0, input.amountCm ?? 0),
        forcesMaximum: false,
        forcesDsq: false,
        reason: input.reason,
        ruleReference: input.ruleReference,
      };
  }
}

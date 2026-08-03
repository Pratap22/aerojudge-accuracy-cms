/** Shared domain types for AeroJudge – FAI Section 7C aligned */

export type Role =
  | 'SUPER_ADMIN'
  | 'PLATFORM_SUPPORT'
  | 'PLATFORM_DEVELOPER'
  | 'COMPETITION_DIRECTOR'
  | 'CHIEF_JUDGE'
  | 'JUDGE'
  | 'SCOREKEEPER'
  | 'LAUNCH_MARSHAL'
  | 'GOAL_MARSHAL'
  | 'ANNOUNCER'
  | 'DISPLAY_OPERATOR'
  | 'PUBLIC_USER';

/** Organization-scoped roles. */
export type OrgRole =
  | 'ORGANIZATION_OWNER'
  | 'CHIEF_JUDGE'
  | 'MEET_DIRECTOR'
  | 'SCORER'
  | 'JUDGE'
  | 'ANNOUNCER'
  | 'DISPLAY_OPERATOR'
  | 'LAUNCH_MARSHAL'
  | 'GOAL_MARSHAL'
  | 'REGISTRATION_OFFICER'
  | 'VIEWER';

export type OrganizationMemberStatus = 'INVITED' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export type CompetitionStatus =
  | 'DRAFT'
  | 'REGISTRATION'
  | 'PRACTICE'
  | 'OFFICIAL'
  | 'PAUSED'
  | 'COMPLETED'
  | 'ARCHIVED'
  | 'CANCELLED';

export type RuleSetVersion = 'FAI_2022' | 'FAI_FUTURE' | 'NPHA_LOCAL' | 'CUSTOM';

export type OrganizationStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export type OrganizationPlan = 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';

export type RoundStatus =
  | 'SCHEDULED'
  | 'BRIEFING'
  | 'OPEN'
  | 'ACTIVE'
  | 'PAUSED'
  | 'CLOSED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'LOCKED'
  | 'CANCELLED';

export type RoundType = 'PRACTICE' | 'OFFICIAL' | 'REFLIGHT' | 'RESTART';

export type FlightOrderType = 'RANDOM' | 'SEEDED' | 'MANUAL' | 'REVERSE';

export type FlightStatus =
  | 'PENDING'
  | 'ON_DECK'
  | 'LAUNCHED'
  | 'LANDED'
  | 'SCORED'
  | 'REFLIGHT'
  | 'DNF'
  | 'ABS'
  | 'DNS'
  | 'DSQ';

export type ScoreResultType =
  | 'MEASURED'
  | 'BULLSEYE'
  | 'MAXIMUM'
  | 'DNF'
  | 'ABS'
  | 'DNS'
  | 'DSQ'
  | 'REFLIGHT'
  | 'PENALTY';

export type ScoreStatus =
  | 'DRAFT'
  | 'ENTERED'
  | 'CONFIRMED'
  | 'DISPUTED'
  | 'APPROVED'
  | 'LOCKED'
  | 'VOID';

export type TeamType = 'NATIONAL' | 'CLUB' | 'WOMEN' | 'MIXED' | 'OPEN' | 'CUSTOM';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export type PilotStatus =
  | 'REGISTERED'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'ACTIVE'
  | 'WITHDRAWN'
  | 'DISQUALIFIED'
  | 'DNS';

export type RankingCategory =
  | 'OVERALL'
  | 'WOMEN'
  | 'JUNIOR'
  | 'COUNTRY'
  | 'TEAM'
  | 'CUSTOM';

export type PrintFormat = 'A4_PORTRAIT' | 'A4_LANDSCAPE' | 'LETTER_PORTRAIT' | 'LETTER_LANDSCAPE';

export type ReportType =
  | 'OVERALL_RESULTS'
  | 'ROUND_RESULTS'
  | 'TEAM_RESULTS'
  | 'COUNTRY_RESULTS'
  | 'WOMEN_RESULTS'
  | 'LAUNCH_ORDER'
  | 'PILOT_LIST'
  | 'REGISTRATION_LIST'
  | 'JUDGE_SHEETS'
  | 'PILOT_CARDS'
  | 'CERTIFICATES'
  | 'STATISTICS'
  | 'AUDIT_REPORT';

export interface RuleConfig {
  version: RuleSetVersion;
  bullseyeScoreCm: number;
  maximumScoreCm: number;
  discardWorstRounds: number;
  discardAfterRounds: number;
  allowReflights: boolean;
  maxReflightsPerRound: number;
  teamSize: number;
  teamScoringPilots: number;
  teamAllowReserves: boolean;
  teamMaxReserves: number;
  womenCategoryEnabled: boolean;
  juniorCategoryEnabled: boolean;
  juniorMaxAge: number;
  /** Non-scoring result types that receive maximum score for ranking */
  maxScoreResultTypes: ScoreResultType[];
  /** Result types excluded from ranking entirely */
  excludeFromRankingTypes: ScoreResultType[];
  tieBreakPriority: TieBreakCriterion[];
  customRules?: Record<string, unknown>;
}

export type TieBreakCriterion =
  | 'MOST_BULLSEYES'
  | 'BEST_SINGLE_SCORE'
  | 'BEST_LAST_ROUND'
  | 'MOST_ROUNDS_FLOWN'
  | 'LOWEST_DISCARDED'
  | 'PILOT_NUMBER';

export interface ScoreInput {
  pilotId: string;
  roundId: string;
  distanceCm: number | null;
  resultType: ScoreResultType;
  penaltyCm?: number;
  isReflight?: boolean;
}

export interface ComputedScore {
  pilotId: string;
  roundId: string;
  distanceCm: number | null;
  resultType: ScoreResultType;
  penaltyCm: number;
  finalScoreCm: number;
  isBullseye: boolean;
  isCountable: boolean;
  notes: string[];
}

export interface RoundScoreEntry {
  pilotId: string;
  roundId: string;
  roundNumber: number;
  finalScoreCm: number;
  resultType: ScoreResultType;
  isBullseye: boolean;
  isDiscarded: boolean;
  /**
   * Synthetic fill for a pilot who has not yet scored this round
   * (live standings use maximumScoreCm). Not counted in roundsFlown.
   */
  isProvisional?: boolean;
}

export interface IndividualRankingResult {
  pilotId: string;
  category: RankingCategory;
  rank: number;
  totalScoreCm: number;
  roundsFlown: number;
  bullseyes: number;
  discardedScoreCm: number | null;
  roundScores: RoundScoreEntry[];
  tieBreakNotes: string;
  audit: ScoringAuditEntry[];
}

export interface TeamPilotContribution {
  pilotId: string;
  scoreCm: number;
  counted: boolean;
  reason: string;
  isReserve: boolean;
}

export interface TeamRoundScoreResult {
  teamId: string;
  roundId: string;
  totalScoreCm: number;
  countedPilots: TeamPilotContribution[];
  discardedPilots: TeamPilotContribution[];
  audit: ScoringAuditEntry[];
}

export interface TeamRankingResult {
  teamId: string;
  category: RankingCategory;
  rank: number;
  totalScoreCm: number;
  roundsScored: number;
  tieBreakNotes: string;
  audit: ScoringAuditEntry[];
}

export interface ScoringAuditEntry {
  timestamp: string;
  step: string;
  detail: string;
  data?: Record<string, unknown>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    timestamp: string;
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  /** Platform / legacy global role. Org access requires membership. */
  role: Role;
  avatarUrl?: string | null;
  /** Active organization context (when selected for this tab). */
  organizationId?: string | null;
  orgRole?: OrgRole | null;
  /** Effective permissions for the active org membership (this tab). */
  permissions?: string[];
  organizations?: AuthOrganizationMembership[];
}

/** Membership summary returned at login /me for organization selector. */
export interface AuthOrganizationMembership {
  id: string;
  organizationId: string;
  name: string;
  shortName: string;
  slug: string;
  logoUrl?: string | null;
  role: OrgRole;
  /** Present when a custom OrganizationRole is assigned. */
  customRoleId?: string | null;
  customRoleName?: string | null;
  /** Effective permission bundle for this membership. */
  permissions: string[];
  status: OrganizationMemberStatus;
}

export interface LoginResult {
  user: AuthUser;
  tokens: AuthTokens;
  organizations: AuthOrganizationMembership[];
  requiresOrganizationSelection: boolean;
}

/** Organization tenant (SaaS root entity). */
export interface Organization {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  description?: string | null;
  logoUrl?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  timezone: string;
  currency: string;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  brandingJson?: Record<string, unknown> | null;
  defaultRuleProfile: RuleSetVersion;
  status: OrganizationStatus;
  isActive: boolean;
  plan: OrganizationPlan;
  licenseKey?: string | null;
  featureFlags?: Record<string, unknown> | null;
  maxCompetitions: number;
  maxUsers: number;
  createdAt: string | Date;
  updatedAt: string | Date;
  settings?: OrganizationSettings | null;
  _count?: { competitions?: number; members?: number };
}

export interface OrganizationSettings {
  id: string;
  organizationId: string;
  generalJson?: Record<string, unknown> | null;
  competitionDefaultsJson?: Record<string, unknown> | null;
  printingDefaultsJson?: Record<string, unknown> | null;
  displayDefaultsJson?: Record<string, unknown> | null;
  certificatesJson?: Record<string, unknown> | null;
  reportsJson?: Record<string, unknown> | null;
  ruleProfileJson?: Record<string, unknown> | null;
  notificationDefaultsJson?: Record<string, unknown> | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface SocketEvents {
  'score:updated': {
    competitionId: string;
    roundId: string;
    score: ComputedScore;
    pilot?: {
      id: string;
      pilotNumber: number;
      firstName: string;
      lastName: string;
      country?: string;
      countryCode?: string;
    };
  };
  'round:status': {
    competitionId: string;
    roundId: string;
    status: RoundStatus;
    number?: number;
  };
  'ranking:updated': { competitionId: string; category: RankingCategory };
  'flight:status': { competitionId: string; flightId: string; status: FlightStatus };
  'announcement:new': { competitionId: string; title: string; body: string; priority: string };
  'wind:updated': { competitionId: string; directionDeg: number; speedMs: number };
  'display:layout': { competitionId: string; layoutType: string; payload: unknown };
  'pilot:current': { competitionId: string; pilotId: string | null; flightId: string | null };
  'results:published': { competitionId: string; roundId: string; category: string };
  'sync:required': { competitionId: string };
  'competition:status': {
    competitionId: string;
    status: CompetitionStatus;
  };
  'sponsors:updated': { competitionId: string };
}

export interface CompetitionSponsor {
  id: string;
  competitionId: string;
  name: string;
  /** Sponsor tier/type — TITLE, GOLD, SILVER, etc. Null when tiers are unused. */
  type: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  displayOrder: number;
  isActive: boolean;
}

/** Public-facing competition officials / judges (manage in Admin → Officials). */
export interface CompetitionOfficial {
  id: string;
  competitionId: string;
  name: string;
  role: string;
  imageUrl: string | null;
  phone: string | null;
  email: string | null;
  displayOrder: number;
  isPublic: boolean;
}

export const ROLES: Role[] = [
  'SUPER_ADMIN',
  'PLATFORM_SUPPORT',
  'PLATFORM_DEVELOPER',
  'COMPETITION_DIRECTOR',
  'CHIEF_JUDGE',
  'JUDGE',
  'SCOREKEEPER',
  'LAUNCH_MARSHAL',
  'GOAL_MARSHAL',
  'ANNOUNCER',
  'DISPLAY_OPERATOR',
  'PUBLIC_USER',
];

export const DEFAULT_FAI_2022_RULES: RuleConfig = {
  version: 'FAI_2022',
  bullseyeScoreCm: 0,
  maximumScoreCm: 1000,
  /** FAI 7C: when ≥5 rounds are completed, discard the worst score */
  discardWorstRounds: 1,
  discardAfterRounds: 5,
  allowReflights: true,
  maxReflightsPerRound: 1,
  teamSize: 4,
  teamScoringPilots: 3,
  teamAllowReserves: true,
  teamMaxReserves: 1,
  womenCategoryEnabled: true,
  juniorCategoryEnabled: true,
  juniorMaxAge: 25,
  maxScoreResultTypes: ['DNF', 'ABS', 'DNS', 'MAXIMUM'],
  excludeFromRankingTypes: ['REFLIGHT'],
  tieBreakPriority: [
    'MOST_BULLSEYES',
    'BEST_SINGLE_SCORE',
    'BEST_LAST_ROUND',
    'MOST_ROUNDS_FLOWN',
    'LOWEST_DISCARDED',
    'PILOT_NUMBER',
  ],
};

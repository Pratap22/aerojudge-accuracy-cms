import { z } from 'zod';

/** Optional string fields: API often returns null; treat null/empty as unset. */
const optionalString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v == null || v === '' ? undefined : v));

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

/** Self-serve AeroJudge account for pilots / officials (not org invitation). */
export const registerParticipantSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
});

/** Claim an existing Person when login email matches the Person contact email. */
export const claimPersonByIdentitySchema = z
  .object({
    aeroJudgeId: optionalString,
    civlId: optionalString,
    personId: optionalString,
  })
  .superRefine((val, ctx) => {
    if (!val.aeroJudgeId && !val.civlId && !val.personId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide personId, aeroJudgeId, or civlId',
        path: ['personId'],
      });
    }
  });

/**
 * Authenticated competition registration.
 * Identity comes from the claimer's Person; competition-specific fields only when profile exists.
 * When user has no Person yet, identity fields create a new Person on submit.
 */
export const authenticatedPilotRegistrationSchema = z.object({
  club: optionalString,
  glider: optionalString,
  harness: optionalString,
  emergencyContact: optionalString,
  emergencyPhone: optionalString,
  // First-time profile / fallback only
  firstName: optionalString,
  lastName: optionalString,
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  countryCode: z
    .union([
      z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{3}$/, 'Use a 3-letter country code'),
      z.literal(''),
      z.undefined(),
    ])
    .transform((v) => (v == null || v === '' ? undefined : v))
    .optional(),
  nationality: optionalString,
  faiLicense: optionalString,
  civlId: optionalString,
  dateOfBirth: z.preprocess(
    (v) => (v == null || v === '' ? undefined : v),
    z
      .union([
        z.string().datetime(),
        z.coerce.date(),
        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      ])
      .optional(),
  ),
});

export const createCompetitionSchema = z.object({
  name: z.string().min(3).max(200),
  code: z.string().min(3).max(50).regex(/^[A-Z0-9-]+$/i),
  organizer: z.string().min(2),
  venue: z.string().min(2),
  country: z.string().min(2),
  location: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  startDate: z.string().datetime().or(z.coerce.date()),
  endDate: z.string().datetime().or(z.coerce.date()),
  practiceDays: z.number().int().min(0).default(0),
  officialDays: z.number().int().min(1).default(1),
  maxRounds: z.number().int().min(1).max(30).default(8),
  practiceRounds: z.number().int().min(0).default(2),
  targetDiameterCm: z.number().int().min(50).max(500).default(200),
  /** Out-of-target / DNF / ABS / DNS score in centimetres – competition-specific */
  maximumScoreCm: z.number().min(1).max(10000).default(1000),
  ruleSet: z.enum(['FAI_2022', 'FAI_FUTURE', 'NPHA_LOCAL', 'CUSTOM']).default('FAI_2022'),
  faiCategory: z.string().default('2'),
  /** Owning organization; omitted → default/active organization. */
  organizationId: z.string().min(1).optional(),
});

export const pilotStatusSchema = z.enum([
  'REGISTERED',
  'CONFIRMED',
  'CHECKED_IN',
  'ACTIVE',
  'REJECTED',
  'WITHDRAWN',
  'DISQUALIFIED',
  'DNS',
]);

export const createPilotBaseSchema = z.object({
  pilotNumber: z.number().int().positive(),
  /** Link to existing Person (returning participant). When set, identity can be omitted. */
  personId: optionalString,
  faiLicense: optionalString,
  civlId: optionalString,
  firstName: z
    .string()
    .min(1)
    .optional()
    .or(z.literal(''))
    .transform((v) => v || undefined),
  lastName: z
    .string()
    .min(1)
    .optional()
    .or(z.literal(''))
    .transform((v) => v || undefined),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).default('MALE'),
  nationality: optionalString,
  countryId: optionalString,
  club: optionalString,
  dateOfBirth: z.preprocess(
    (v) => (v == null || v === '' ? undefined : v),
    z.union([z.string().datetime(), z.coerce.date()]).optional(),
  ),
  glider: optionalString,
  harness: optionalString,
  reserveStatus: optionalString,
  emergencyContact: optionalString,
  emergencyPhone: optionalString,
  medicalNotes: optionalString,
  /**
   * Organizer create defaults to CONFIRMED on the server when omitted.
   * Public self-registration always uses REGISTERED.
   */
  status: pilotStatusSchema.optional(),
});

export const createPilotSchema = createPilotBaseSchema.superRefine((val, ctx) => {
  if (val.personId) return;
  if (!val.firstName?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'First name is required',
      path: ['firstName'],
    });
  }
  if (!val.lastName?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Last name is required',
      path: ['lastName'],
    });
  }
});

export const updatePilotSchema = createPilotBaseSchema.partial();

/** Dedicated accept/reject (and other status transitions). */
export const updatePilotStatusSchema = z.object({
  status: pilotStatusSchema,
});

/** Public self-registration — pilot number is assigned by the server. */
export const publicPilotRegistrationSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).default('MALE'),
  /** ISO 3166-1 alpha-3 (e.g. IND, NPL) */
  countryCode: z
    .union([
      z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{3}$/, 'Use a 3-letter country code'),
      z.literal(''),
      z.undefined(),
    ])
    .transform((v) => (v == null || v === '' ? undefined : v))
    .optional(),
  nationality: optionalString,
  faiLicense: optionalString,
  civlId: optionalString,
  club: optionalString,
  dateOfBirth: z.preprocess(
    (v) => (v == null || v === '' ? undefined : v),
    z
      .union([
        z.string().datetime(),
        z.coerce.date(),
        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      ])
      .optional(),
  ),
  glider: optionalString,
  harness: optionalString,
  emergencyContact: optionalString,
  emergencyPhone: optionalString,
});

export const createTeamSchema = z.object({
  name: z.string().min(2),
  type: z.enum(['NATIONAL', 'CLUB', 'WOMEN', 'MIXED', 'OPEN', 'CUSTOM']).default('NATIONAL'),
  countryId: z.string().optional(),
  memberPilotIds: z.array(z.string()).optional(),
  captainId: z.string().optional(),
  viceCaptainId: z.string().optional(),
});

export const createRoundSchema = z.object({
  number: z.number().int().positive(),
  name: z.string().optional(),
  type: z.enum(['PRACTICE', 'OFFICIAL', 'REFLIGHT', 'RESTART']).default('OFFICIAL'),
  orderType: z.enum(['RANDOM', 'SEEDED', 'MANUAL', 'REVERSE']).default('RANDOM'),
  scheduledAt: z.string().datetime().or(z.coerce.date()).optional(),
});

/** Only round type may be edited after creation */
export const updateRoundTypeSchema = z.object({
  type: z.enum(['PRACTICE', 'OFFICIAL', 'REFLIGHT', 'RESTART']),
});

export const enterScoreSchema = z.object({
  flightId: z.string().min(1),
  distanceCm: z.number().min(0).max(10000).nullable(),
  resultType: z
    .enum(['MEASURED', 'BULLSEYE', 'MAXIMUM', 'DNF', 'ABS', 'DNS', 'DSQ', 'REFLIGHT', 'PENALTY'])
    .default('MEASURED'),
  penaltyCm: z.number().min(0).default(0),
  judgeNotes: z.string().optional(),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum([
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
  ]),
  phone: z.string().optional(),
});

/** Super Admin sets/resets another user's password (platform Users page). */
export const setUserPasswordSchema = z
  .object({
    password: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/** Request a password-reset email (self-serve). */
export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

/** Complete password reset with emailed one-time token. */
export const resetPasswordSchema = z
  .object({
    token: z.string().min(32).max(256),
    password: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const userStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']);

/** Profile fields only — use setUserPasswordSchema for password changes. */
export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  role: z
    .enum([
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
    ])
    .optional(),
  phone: z.string().optional().nullable(),
  status: userStatusSchema.optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

/** Platform users list — defaults to ACTIVE (soft-deleted users are INACTIVE). */
export const listUsersQuerySchema = paginationSchema.extend({
  status: z.union([userStatusSchema, z.literal('ALL')]).default('ACTIVE'),
});

const orgSlugSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens');

const hexColorSchema = z
  .union([
    z.string().regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, 'Must be a hex color'),
    z.literal(''),
    z.null(),
    z.undefined(),
  ])
  .transform((v) => (v == null || v === '' ? undefined : v));

export const organizationStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']);
export const organizationPlanSchema = z.enum(['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE']);

export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(200),
  shortName: z.string().min(1).max(50),
  slug: orgSlugSchema,
  description: optionalString,
  website: optionalString,
  email: z
    .union([z.string().email(), z.null(), z.undefined(), z.literal('')])
    .transform((v) => (v == null || v === '' ? undefined : v))
    .optional(),
  phone: optionalString,
  address: optionalString,
  city: optionalString,
  state: optionalString,
  country: optionalString,
  timezone: z.string().min(1).max(80).default('UTC'),
  currency: z.string().min(3).max(3).default('USD'),
  primaryColor: hexColorSchema,
  secondaryColor: hexColorSchema,
  accentColor: hexColorSchema,
  brandingJson: z.record(z.unknown()).optional(),
  defaultRuleProfile: z.enum(['FAI_2022', 'FAI_FUTURE', 'NPHA_LOCAL', 'CUSTOM']).default('FAI_2022'),
  plan: organizationPlanSchema.default('FREE'),
  featureFlags: z.record(z.unknown()).optional(),
  maxCompetitions: z.number().int().min(1).max(10000).default(10),
  maxUsers: z.number().int().min(1).max(100000).default(25),
});

export const updateOrganizationSchema = createOrganizationSchema.partial().extend({
  logoUrl: optionalString,
  licenseKey: optionalString,
});

export const updateOrganizationStatusSchema = z.object({
  status: organizationStatusSchema,
  isActive: z.boolean().optional(),
});

export const organizationSettingsSchema = z.object({
  generalJson: z.record(z.unknown()).nullable().optional(),
  competitionDefaultsJson: z.record(z.unknown()).nullable().optional(),
  printingDefaultsJson: z.record(z.unknown()).nullable().optional(),
  displayDefaultsJson: z.record(z.unknown()).nullable().optional(),
  certificatesJson: z.record(z.unknown()).nullable().optional(),
  reportsJson: z.record(z.unknown()).nullable().optional(),
  ruleProfileJson: z.record(z.unknown()).nullable().optional(),
  notificationDefaultsJson: z.record(z.unknown()).nullable().optional(),
});

export const listOrganizationsQuerySchema = paginationSchema.extend({
  status: organizationStatusSchema.optional(),
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (typeof v === 'boolean') return v;
      return v === 'true';
    }),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterParticipantInput = z.infer<typeof registerParticipantSchema>;
export type ClaimPersonByIdentityInput = z.infer<typeof claimPersonByIdentitySchema>;
export type AuthenticatedPilotRegistrationInput = z.infer<
  typeof authenticatedPilotRegistrationSchema
>;
export type CreateCompetitionInput = z.infer<typeof createCompetitionSchema>;
export type CreatePilotInput = z.infer<typeof createPilotSchema>;
export type UpdatePilotInput = z.infer<typeof updatePilotSchema>;
export type UpdatePilotStatusInput = z.infer<typeof updatePilotStatusSchema>;
export type PublicPilotRegistrationInput = z.infer<typeof publicPilotRegistrationSchema>;
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type CreateRoundInput = z.infer<typeof createRoundSchema>;
export type UpdateRoundTypeInput = z.infer<typeof updateRoundTypeSchema>;
export type EnterScoreInput = z.infer<typeof enterScoreSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type SetUserPasswordInput = z.infer<typeof setUserPasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type UpdateOrganizationStatusInput = z.infer<typeof updateOrganizationStatusSchema>;
export type OrganizationSettingsInput = z.infer<typeof organizationSettingsSchema>;
export type ListOrganizationsQuery = z.infer<typeof listOrganizationsQuerySchema>;

export const selectOrganizationSchema = z.object({
  organizationId: z.string().min(1),
});

export const orgRoleSchema = z.enum([
  'ORGANIZATION_OWNER',
  'CHIEF_JUDGE',
  'MEET_DIRECTOR',
  'SCORER',
  'JUDGE',
  'ANNOUNCER',
  'DISPLAY_OPERATOR',
  'LAUNCH_MARSHAL',
  'GOAL_MARSHAL',
  'REGISTRATION_OFFICER',
  'VIEWER',
]);

export const inviteOrganizationMemberSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  password: z.string().min(8).optional(),
  role: orgRoleSchema.default('VIEWER'),
});

export const updateOrganizationMemberSchema = z.object({
  role: orgRoleSchema.optional(),
  customRoleId: z.string().min(1).nullable().optional(),
  status: z.enum(['INVITED', 'ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
});

export const createOrganizationRoleSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/, 'Use lowercase snake_case keys'),
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional(),
  permissions: z.array(z.string().min(1)).min(1),
  basedOnOrgRole: orgRoleSchema.optional(),
});

export const updateOrganizationRoleSchema = createOrganizationRoleSchema.partial();

export const SPONSOR_TYPES = [
  'TITLE',
  'PRESENTING',
  'GOLD',
  'SILVER',
  'BRONZE',
  'STANDARD',
] as const;

export const sponsorTypeSchema = z.enum(SPONSOR_TYPES);

/** Common labels for competition partners (free-form string also allowed). */
export const PARTNER_LABEL_OPTIONS = ['Sponsors', 'Supporters'] as const;

export const createSponsorSchema = z.object({
  name: z.string().min(1).max(200),
  /** Omit or null when the competition does not use sponsor tiers */
  type: sponsorTypeSchema.nullable().optional(),
  websiteUrl: optionalString,
  logoUrl: optionalString,
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const updateSponsorSchema = createSponsorSchema.partial();

/** Suggested role labels for public officials (free-form string also allowed). */
export const OFFICIAL_ROLE_OPTIONS = [
  'Chief Judge',
  'Meet Director',
  'Event Director',
  'Judge',
  'Scorekeeper',
  'Launch Marshal',
  'Goal Marshal',
  'Announcer',
  'Safety Officer',
  'Registration Officer',
] as const;

/** Lower number = higher precedence on public/admin lists. Unknown roles sort last. */
export function officialRoleRank(role: string): number {
  const normalized = role.trim().toLowerCase();
  const idx = OFFICIAL_ROLE_OPTIONS.findIndex((r) => r.toLowerCase() === normalized);
  return idx === -1 ? OFFICIAL_ROLE_OPTIONS.length : idx;
}

/** Stable list order: role hierarchy, then manual displayOrder, then name. */
export function compareOfficials<
  T extends { role: string; displayOrder: number; name: string },
>(a: T, b: T): number {
  const byRole = officialRoleRank(a.role) - officialRoleRank(b.role);
  if (byRole !== 0) return byRole;
  if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

export const createOfficialBaseSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(200)
    .optional()
    .or(z.literal(''))
    .transform((v) => v || undefined),
  role: z.string().min(1).max(120),
  /** Reuse existing Person from the directory. */
  personId: optionalString,
  competitionRole: z
    .enum([
      'PILOT',
      'CHIEF_JUDGE',
      'TARGET_JUDGE',
      'JUDGE',
      'MEET_DIRECTOR',
      'SCORER',
      'ANNOUNCER',
      'DISPLAY_OPERATOR',
      'LAUNCH_MARSHAL',
      'GOAL_MARSHAL',
      'REGISTRATION_OFFICER',
      'SAFETY_DIRECTOR',
      'TECHNICAL_DELEGATE',
      'VIEWER',
      'OTHER',
    ])
    .optional(),
  imageUrl: optionalString,
  phone: optionalString,
  email: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.string().email().optional(),
  ),
  displayOrder: z.number().int().min(0).optional(),
  isPublic: z.boolean().optional(),
});

export const createOfficialSchema = createOfficialBaseSchema.superRefine((val, ctx) => {
  if (!val.personId && !val.name?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Name is required',
      path: ['name'],
    });
  }
});

export const updateOfficialSchema = createOfficialBaseSchema.partial();

export const partnersDisplaySettingsSchema = z.object({
  partnersLabel: z.string().min(1).max(40).optional(),
  partnerTiersEnabled: z.boolean().optional(),
});

export type SelectOrganizationInput = z.infer<typeof selectOrganizationSchema>;
export type InviteOrganizationMemberInput = z.infer<typeof inviteOrganizationMemberSchema>;
export type UpdateOrganizationMemberInput = z.infer<typeof updateOrganizationMemberSchema>;
export type CreateOrganizationRoleInput = z.infer<typeof createOrganizationRoleSchema>;
export type UpdateOrganizationRoleInput = z.infer<typeof updateOrganizationRoleSchema>;
export type CreateSponsorInput = z.infer<typeof createSponsorSchema>;
export type UpdateSponsorInput = z.infer<typeof updateSponsorSchema>;
export type SponsorType = z.infer<typeof sponsorTypeSchema>;
export type PartnersDisplaySettings = z.infer<typeof partnersDisplaySettingsSchema>;
export type CreateOfficialInput = z.infer<typeof createOfficialSchema>;
export type UpdateOfficialInput = z.infer<typeof updateOfficialSchema>;

// ─── Competition event info (public brochure) ───

const richHtml = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (v === undefined ? undefined : v));

export const updateCompetitionInfoSchema = z.object({
  aboutHtml: richHtml,
  dailyScheduleHtml: richHtml,
  selectionRulesHtml: richHtml,
  entryFeePaymentHtml: richHtml,
  flyingSiteHtml: richHtml,
  travelInfoHtml: richHtml,
  mapLabel: optionalString,
  mapZoom: z.number().int().min(1).max(19).optional(),
  /** Event map coordinates (stored on Competition). */
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  location: optionalString,
});

export const createGalleryImageSchema = z.object({
  caption: optionalString,
  displayOrder: z.number().int().min(0).optional(),
  /** When creating from an already-uploaded URL (optional — usual path is multipart upload). */
  url: optionalString,
});

export const updateGalleryImageSchema = z.object({
  caption: optionalString,
  displayOrder: z.number().int().min(0).optional(),
});

export const createCompetitionLinkSchema = z.object({
  label: z.string().min(1).max(200),
  url: z.string().url().max(2000),
  displayOrder: z.number().int().min(0).optional(),
});

export const updateCompetitionLinkSchema = createCompetitionLinkSchema.partial();

export const createCompetitionContactSchema = z.object({
  name: z.string().min(1).max(200),
  role: z.string().min(1).max(120),
  phone: optionalString,
  email: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.string().email().optional(),
  ),
  displayOrder: z.number().int().min(0).optional(),
  isPublic: z.boolean().optional(),
});

export const updateCompetitionContactSchema = createCompetitionContactSchema.partial();

export const updateCompetitionSchema = createCompetitionSchema
  .omit({ organizationId: true, maximumScoreCm: true })
  .partial();

/** True when HTML has no visible text (empty editor / whitespace-only). */
export function isEmptyHtml(html: string | null | undefined): boolean {
  if (html == null || html.trim() === '') return true;
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#\d+;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length === 0;
}

export type UpdateCompetitionInfoInput = z.infer<typeof updateCompetitionInfoSchema>;
export type CreateGalleryImageInput = z.infer<typeof createGalleryImageSchema>;
export type UpdateGalleryImageInput = z.infer<typeof updateGalleryImageSchema>;
export type CreateCompetitionLinkInput = z.infer<typeof createCompetitionLinkSchema>;
export type UpdateCompetitionLinkInput = z.infer<typeof updateCompetitionLinkSchema>;
export type CreateCompetitionContactInput = z.infer<typeof createCompetitionContactSchema>;
export type UpdateCompetitionContactInput = z.infer<typeof updateCompetitionContactSchema>;
export type UpdateCompetitionInput = z.infer<typeof updateCompetitionSchema>;

// ─── Person directory ───

export const competitionRoleSchema = z.enum([
  'PILOT',
  'CHIEF_JUDGE',
  'TARGET_JUDGE',
  'JUDGE',
  'MEET_DIRECTOR',
  'SCORER',
  'ANNOUNCER',
  'DISPLAY_OPERATOR',
  'LAUNCH_MARSHAL',
  'GOAL_MARSHAL',
  'REGISTRATION_OFFICER',
  'SAFETY_DIRECTOR',
  'TECHNICAL_DELEGATE',
  'VIEWER',
  'OTHER',
]);

export const createPersonSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  middleName: optionalString,
  preferredName: optionalString,
  displayName: optionalString,
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).default('MALE'),
  dateOfBirth: z.preprocess(
    (v) => (v == null || v === '' ? undefined : v),
    z.union([z.string().datetime(), z.coerce.date()]).optional(),
  ),
  nationalityCountryId: optionalString,
  nationality: optionalString,
  photoUrl: optionalString,
  civlId: optionalString,
  faiLicenseNumber: optionalString,
  faiLicenseExpiry: z.preprocess(
    (v) => (v == null || v === '' ? undefined : v),
    z.union([z.string().datetime(), z.coerce.date()]).optional(),
  ),
  email: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.string().email().optional(),
  ),
  phone: optionalString,
  visibility: z.enum(['PRIVATE', 'ORGANIZATIONS_ONLY', 'PUBLIC']).optional(),
  forceCreate: z.boolean().optional(),
});

export const updatePersonSchema = createPersonSchema.partial().omit({ forceCreate: true });

export const matchPersonSchema = z.object({
  aeroJudgeId: optionalString,
  civlId: optionalString,
  faiLicenseNumber: optionalString,
  email: optionalString,
  firstName: optionalString,
  lastName: optionalString,
  nationalityCountryId: optionalString,
  query: optionalString,
});

export const mergePersonSchema = z.object({
  duplicatePersonId: z.string().min(1),
});

export const requestProfileClaimSchema = z.object({
  verificationMethod: z.string().min(1).max(120),
});

/** Organiser links an AeroJudge login to an existing Person (force claim). */
export const linkUserToPersonSchema = z
  .object({
    userId: z.string().min(1).optional(),
    userEmail: z.string().email().optional(),
  })
  .refine((v) => Boolean(v.userId?.trim() || v.userEmail?.trim()), {
    message: 'userId or userEmail is required',
  });

export type CreatePersonInput = z.infer<typeof createPersonSchema>;
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;
export type MatchPersonInput = z.infer<typeof matchPersonSchema>;
export type CompetitionRoleType = z.infer<typeof competitionRoleSchema>;
export type LinkUserToPersonInput = z.infer<typeof linkUserToPersonSchema>;

import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
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

/** Optional string fields: API often returns null; treat null/empty as unset. */
const optionalString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v == null || v === '' ? undefined : v));

export const createPilotSchema = z.object({
  pilotNumber: z.number().int().positive(),
  faiLicense: optionalString,
  civlId: optionalString,
  firstName: z.string().min(1),
  lastName: z.string().min(1),
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
});

export const updatePilotSchema = createPilotSchema.partial();

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

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
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
export type CreateCompetitionInput = z.infer<typeof createCompetitionSchema>;
export type CreatePilotInput = z.infer<typeof createPilotSchema>;
export type UpdatePilotInput = z.infer<typeof updatePilotSchema>;
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type CreateRoundInput = z.infer<typeof createRoundSchema>;
export type UpdateRoundTypeInput = z.infer<typeof updateRoundTypeSchema>;
export type EnterScoreInput = z.infer<typeof enterScoreSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type UpdateOrganizationStatusInput = z.infer<typeof updateOrganizationStatusSchema>;
export type OrganizationSettingsInput = z.infer<typeof organizationSettingsSchema>;
export type ListOrganizationsQuery = z.infer<typeof listOrganizationsQuerySchema>;

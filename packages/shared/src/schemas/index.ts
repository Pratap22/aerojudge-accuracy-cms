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
});

export const createPilotSchema = z.object({
  pilotNumber: z.number().int().positive(),
  faiLicense: z.string().optional(),
  civlId: z.string().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).default('MALE'),
  nationality: z.string().optional(),
  countryId: z.string().optional(),
  club: z.string().optional(),
  dateOfBirth: z.string().datetime().or(z.coerce.date()).optional(),
  glider: z.string().optional(),
  harness: z.string().optional(),
  reserveStatus: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  medicalNotes: z.string().optional(),
});

export const createTeamSchema = z.object({
  name: z.string().min(2),
  type: z.enum(['NATIONAL', 'CLUB', 'WOMEN', 'MIXED', 'OPEN', 'CUSTOM']).default('NATIONAL'),
  countryId: z.string().optional(),
  maxSize: z.number().int().min(1).max(20).default(4),
  scoringPilots: z.number().int().min(1).max(20).default(3),
  maxReserves: z.number().int().min(0).max(10).default(1),
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

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateCompetitionInput = z.infer<typeof createCompetitionSchema>;
export type CreatePilotInput = z.infer<typeof createPilotSchema>;
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type CreateRoundInput = z.infer<typeof createRoundSchema>;
export type UpdateRoundTypeInput = z.infer<typeof updateRoundTypeSchema>;
export type EnterScoreInput = z.infer<typeof enterScoreSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;

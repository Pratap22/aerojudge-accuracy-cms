/**
 * NPHA Accuracy CMS – development seed data
 * Run: npm run seed --workspace=@npha/database
 */
import bcrypt from 'bcryptjs';
import {
  PrismaClient,
  Role,
  CompetitionStatus,
  RuleSetVersion,
  Gender,
  PilotStatus,
  TeamType,
  TeamMemberRole,
  RoundType,
  RoundStatus,
  FlightOrderType,
  FlightStatus,
  ScoreResultType,
  ScoreStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_FAI_2022_RULES = {
  version: 'FAI_2022',
  bullseyeScoreCm: 0,
  maximumScoreCm: 1000,
  discardWorstRounds: 0,
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

const COUNTRIES = [
  { code: 'NPL', code2: 'NP', name: 'Nepal' },
  { code: 'IND', code2: 'IN', name: 'India' },
  { code: 'CHN', code2: 'CN', name: 'China' },
  { code: 'FRA', code2: 'FR', name: 'France' },
  { code: 'GBR', code2: 'GB', name: 'United Kingdom' },
  { code: 'USA', code2: 'US', name: 'United States' },
  { code: 'CHE', code2: 'CH', name: 'Switzerland' },
  { code: 'AUT', code2: 'AT', name: 'Austria' },
  { code: 'JPN', code2: 'JP', name: 'Japan' },
  { code: 'KOR', code2: 'KR', name: 'Korea' },
] as const;

interface PilotSeed {
  pilotNumber: number;
  firstName: string;
  lastName: string;
  countryCode: string;
  gender: Gender;
  isWomen: boolean;
  isJunior: boolean;
  glider: string;
  club?: string;
  dateOfBirth?: Date;
}

const PILOTS: PilotSeed[] = [
  { pilotNumber: 1, firstName: 'Rajesh', lastName: 'Gurung', countryCode: 'NPL', gender: 'MALE', isWomen: false, isJunior: false, glider: 'Ozone Enzo 3', club: 'Pokhara Paragliding Club' },
  { pilotNumber: 2, firstName: 'Sunita', lastName: 'Tamang', countryCode: 'NPL', gender: 'FEMALE', isWomen: true, isJunior: false, glider: 'Gin Bonanza 3', club: 'Nepal Air Sports Association' },
  { pilotNumber: 3, firstName: 'Bikash', lastName: 'Shrestha', countryCode: 'NPL', gender: 'MALE', isWomen: false, isJunior: true, glider: 'Nova Mentor 7', club: 'Kathmandu XC Club', dateOfBirth: new Date('2001-03-15') },
  { pilotNumber: 4, firstName: 'Anil', lastName: 'Rai', countryCode: 'NPL', gender: 'MALE', isWomen: false, isJunior: false, glider: 'Advance Sigma 12', club: 'Pokhara Paragliding Club' },
  { pilotNumber: 5, firstName: 'Arjun', lastName: 'Patel', countryCode: 'IND', gender: 'MALE', isWomen: false, isJunior: false, glider: 'Ozone Enzo 3', club: 'Indian Paragliding Federation' },
  { pilotNumber: 6, firstName: 'Priya', lastName: 'Sharma', countryCode: 'IND', gender: 'FEMALE', isWomen: true, isJunior: false, glider: 'Gin Bonanza 3', club: 'Bir Billing PG Club' },
  { pilotNumber: 7, firstName: 'Rohan', lastName: 'Mehta', countryCode: 'IND', gender: 'MALE', isWomen: false, isJunior: true, glider: 'Nova Mentor 7', club: 'Himachal PG Academy', dateOfBirth: new Date('2000-08-22') },
  { pilotNumber: 8, firstName: 'Vikram', lastName: 'Singh', countryCode: 'IND', gender: 'MALE', isWomen: false, isJunior: false, glider: 'Advance Iota 3', club: 'Indian Paragliding Federation' },
  { pilotNumber: 9, firstName: 'Luc', lastName: 'Moreau', countryCode: 'FRA', gender: 'MALE', isWomen: false, isJunior: false, glider: 'Ozone Zeno 2', club: 'FFVL' },
  { pilotNumber: 10, firstName: 'Camille', lastName: 'Dubois', countryCode: 'FRA', gender: 'FEMALE', isWomen: true, isJunior: false, glider: 'Gin Explorer 2', club: 'Chamonix PG Team' },
  { pilotNumber: 11, firstName: 'Antoine', lastName: 'Bernard', countryCode: 'FRA', gender: 'MALE', isWomen: false, isJunior: true, glider: 'Nova Mentor 7', club: 'FFVL', dateOfBirth: new Date('1999-11-05') },
  { pilotNumber: 12, firstName: 'Pierre', lastName: 'Lefevre', countryCode: 'FRA', gender: 'MALE', isWomen: false, isJunior: false, glider: 'Advance Sigma 12', club: 'Annecy Accuracy Team' },
  { pilotNumber: 13, firstName: 'Marco', lastName: 'Steiner', countryCode: 'CHE', gender: 'MALE', isWomen: false, isJunior: false, glider: 'Ozone Enzo 3', club: 'Swiss Paragliding Association' },
  { pilotNumber: 14, firstName: 'Elena', lastName: 'Müller', countryCode: 'CHE', gender: 'FEMALE', isWomen: true, isJunior: false, glider: 'Gin Bonanza 3', club: 'Interlaken PG Club' },
  { pilotNumber: 15, firstName: 'Jonas', lastName: 'Weber', countryCode: 'CHE', gender: 'MALE', isWomen: false, isJunior: true, glider: 'Nova Mentor 7', club: 'Swiss Paragliding Association', dateOfBirth: new Date('2002-01-18') },
  { pilotNumber: 16, firstName: 'Thomas', lastName: 'Keller', countryCode: 'CHE', gender: 'MALE', isWomen: false, isJunior: false, glider: 'Advance Iota 3', club: 'Verbier PG Team' },
  { pilotNumber: 17, firstName: 'Wei', lastName: 'Zhang', countryCode: 'CHN', gender: 'MALE', isWomen: false, isJunior: false, glider: 'Ozone Enzo 3', club: 'China Air Sports Federation' },
  { pilotNumber: 18, firstName: 'James', lastName: 'Thornton', countryCode: 'GBR', gender: 'MALE', isWomen: false, isJunior: false, glider: 'Gin Explorer 2', club: 'BHPA' },
  { pilotNumber: 19, firstName: 'Sarah', lastName: 'Mitchell', countryCode: 'USA', gender: 'FEMALE', isWomen: true, isJunior: false, glider: 'Ozone Zeno 2', club: 'USHPA' },
  { pilotNumber: 20, firstName: 'Klaus', lastName: 'Huber', countryCode: 'AUT', gender: 'MALE', isWomen: false, isJunior: false, glider: 'Advance Sigma 12', club: 'Österreichischer Aeroclub' },
  { pilotNumber: 21, firstName: 'Yuki', lastName: 'Tanaka', countryCode: 'JPN', gender: 'MALE', isWomen: false, isJunior: true, glider: 'Nova Mentor 7', club: 'Japan Paragliding Association', dateOfBirth: new Date('2001-07-30') },
  { pilotNumber: 22, firstName: 'Min-jun', lastName: 'Park', countryCode: 'KOR', gender: 'MALE', isWomen: false, isJunior: false, glider: 'Gin Bonanza 3', club: 'Korea Paragliding Association' },
  { pilotNumber: 23, firstName: 'Maya', lastName: 'Thapa', countryCode: 'NPL', gender: 'FEMALE', isWomen: true, isJunior: true, glider: 'Nova Mentor 7', club: 'Pokhara Paragliding Club', dateOfBirth: new Date('2003-05-12') },
  { pilotNumber: 24, firstName: 'David', lastName: 'Chen', countryCode: 'USA', gender: 'MALE', isWomen: false, isJunior: false, glider: 'Ozone Enzo 3', club: 'USHPA' },
];

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

async function seedCountries() {
  const map = new Map<string, string>();
  for (const c of COUNTRIES) {
    const country = await prisma.country.upsert({
      where: { code: c.code },
      update: { name: c.name, code2: c.code2 },
      create: { code: c.code, code2: c.code2, name: c.name },
    });
    map.set(c.code, country.id);
  }
  return map;
}

async function seedUsers() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@npha.org.np';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'NphaAdmin@2024!';
  const passwordHash = await hashPassword(adminPassword);

  const users = [
    {
      email: adminEmail,
      passwordHash,
      firstName: 'System',
      lastName: 'Administrator',
      role: Role.SUPER_ADMIN,
    },
    {
      email: 'director@npha.org.np',
      passwordHash: await hashPassword('Director@2024!'),
      firstName: 'Ram',
      lastName: 'Adhikari',
      role: Role.COMPETITION_DIRECTOR,
    },
    {
      email: 'chiefjudge@npha.org.np',
      passwordHash: await hashPassword('ChiefJudge@2024!'),
      firstName: 'Peter',
      lastName: 'Schmidt',
      role: Role.CHIEF_JUDGE,
    },
    {
      email: 'judge@npha.org.np',
      passwordHash: await hashPassword('Judge@2024!'),
      firstName: 'Sophie',
      lastName: 'Martin',
      role: Role.JUDGE,
    },
    {
      email: 'scorekeeper@npha.org.np',
      passwordHash: await hashPassword('Scorekeeper@2024!'),
      firstName: 'Anita',
      lastName: 'Gurung',
      role: Role.SCOREKEEPER,
    },
  ];

  const created = new Map<Role, string>();
  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        passwordHash: u.passwordHash,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
      },
      create: u,
    });
    created.set(u.role, user.id);
  }
  return created;
}

async function seedCompetition() {
  const startDate = new Date('2024-11-15T08:00:00+05:45');
  const endDate = new Date('2024-11-17T18:00:00+05:45');

  const competition = await prisma.competition.upsert({
    where: { code: 'NPHA-ACC-2024' },
    update: {
      name: 'NPHA National Accuracy Championship 2024',
      status: CompetitionStatus.OFFICIAL,
      isPublished: true,
    },
    create: {
      name: 'NPHA National Accuracy Championship 2024',
      code: 'NPHA-ACC-2024',
      organizer: 'Nepal Paragliding & Hang Gliding Association (NPHA)',
      venue: 'Sarangkot Launch, Pokhara',
      country: 'Nepal',
      location: 'Pokhara, Kaski District',
      latitude: 28.2096,
      longitude: 83.9856,
      startDate,
      endDate,
      practiceDays: 1,
      officialDays: 2,
      maxRounds: 8,
      practiceRounds: 2,
      targetDiameterCm: 200,
      ruleSet: RuleSetVersion.FAI_2022,
      status: CompetitionStatus.OFFICIAL,
      faiCategory: '2',
      publicSlug: 'npha-acc-2024',
      isPublished: true,
      brandingJson: {
        primaryColor: '#0b1f33',
        accentColor: '#0ea5e9',
        logoText: 'NPHA Accuracy 2024',
      },
    },
  });

  await prisma.competitionSettings.upsert({
    where: { competitionId: competition.id },
    update: {},
    create: {
      competitionId: competition.id,
    },
  });

  await prisma.ruleProfile.upsert({
    where: { id: `${competition.id}-fai-2022` },
    update: {
      rulesJson: DEFAULT_FAI_2022_RULES,
    },
    create: {
      id: `${competition.id}-fai-2022`,
      competitionId: competition.id,
      name: 'FAI Sporting Code Section 7C (2022)',
      version: RuleSetVersion.FAI_2022,
      description: 'Default FAI Category 2 paragliding accuracy rules for NPHA National Championship 2024',
      rulesJson: DEFAULT_FAI_2022_RULES,
      isDefault: true,
    },
  });

  return competition;
}

async function seedCompetitionRoles(
  competitionId: string,
  users: Map<Role, string>,
) {
  const roles: Role[] = [
    Role.COMPETITION_DIRECTOR,
    Role.CHIEF_JUDGE,
    Role.JUDGE,
    Role.SCOREKEEPER,
  ];

  for (const role of roles) {
    const userId = users.get(role);
    if (!userId) continue;
    await prisma.competitionUser.upsert({
      where: {
        competitionId_userId_role: { competitionId, userId, role },
      },
      update: {},
      create: { competitionId, userId, role },
    });
  }
}

async function seedPilots(competitionId: string, countryMap: Map<string, string>) {
  const pilotRecords: Array<{ id: string; pilotNumber: number }> = [];

  for (const p of PILOTS) {
    const countryId = countryMap.get(p.countryCode);
    const pilot = await prisma.pilot.upsert({
      where: {
        competitionId_pilotNumber: { competitionId, pilotNumber: p.pilotNumber },
      },
      update: {
        firstName: p.firstName,
        lastName: p.lastName,
        gender: p.gender,
        isWomen: p.isWomen,
        isJunior: p.isJunior,
        glider: p.glider,
        club: p.club,
        countryId,
        nationality: COUNTRIES.find((c) => c.code === p.countryCode)?.name,
        status: PilotStatus.ACTIVE,
        dateOfBirth: p.dateOfBirth,
      },
      create: {
        competitionId,
        pilotNumber: p.pilotNumber,
        firstName: p.firstName,
        lastName: p.lastName,
        gender: p.gender,
        isWomen: p.isWomen,
        isJunior: p.isJunior,
        glider: p.glider,
        gliderSize: 'M',
        club: p.club,
        countryId,
        nationality: COUNTRIES.find((c) => c.code === p.countryCode)?.name,
        status: PilotStatus.ACTIVE,
        dateOfBirth: p.dateOfBirth,
        faiLicense: `FAI-${p.countryCode}-${p.pilotNumber.toString().padStart(4, '0')}`,
      },
    });
    pilotRecords.push({ id: pilot.id, pilotNumber: pilot.pilotNumber });
  }

  return pilotRecords;
}

async function seedTeams(
  competitionId: string,
  countryMap: Map<string, string>,
  pilots: Array<{ id: string; pilotNumber: number }>,
) {
  const pilotByNumber = new Map(pilots.map((p) => [p.pilotNumber, p.id]));

  const teams = [
    {
      name: 'Team Nepal',
      countryCode: 'NPL',
      pilotNumbers: [1, 2, 3, 4],
      reserveNumber: 4,
      captainNumber: 1,
    },
    {
      name: 'Team India',
      countryCode: 'IND',
      pilotNumbers: [5, 6, 7, 8],
      reserveNumber: 8,
      captainNumber: 5,
    },
    {
      name: 'Team France',
      countryCode: 'FRA',
      pilotNumbers: [9, 10, 11, 12],
      reserveNumber: 12,
      captainNumber: 9,
    },
    {
      name: 'Team Switzerland',
      countryCode: 'CHE',
      pilotNumbers: [13, 14, 15, 16],
      reserveNumber: 16,
      captainNumber: 13,
    },
  ];

  for (const t of teams) {
    const countryId = countryMap.get(t.countryCode)!;
    const captainId = pilotByNumber.get(t.captainNumber)!;

    const team = await prisma.team.upsert({
      where: { competitionId_name: { competitionId, name: t.name } },
      update: { isValid: true, validationNotes: 'Validated: 3 scoring pilots + 1 reserve' },
      create: {
        competitionId,
        name: t.name,
        type: TeamType.NATIONAL,
        countryId,
        captainId,
        isValid: true,
        validationNotes: 'Validated: 3 scoring pilots + 1 reserve',
      },
    });

    for (let i = 0; i < t.pilotNumbers.length; i++) {
      const pilotNumber = t.pilotNumbers[i];
      const pilotId = pilotByNumber.get(pilotNumber)!;
      const isReserve = pilotNumber === t.reserveNumber;

      await prisma.teamMember.upsert({
        where: { teamId_pilotId: { teamId: team.id, pilotId } },
        update: {
          role: isReserve ? TeamMemberRole.RESERVE : TeamMemberRole.PILOT,
          order: i,
        },
        create: {
          teamId: team.id,
          pilotId,
          role: isReserve ? TeamMemberRole.RESERVE : TeamMemberRole.PILOT,
          order: i,
        },
      });
    }
  }
}

async function seedRound1(
  competitionId: string,
  pilots: Array<{ id: string; pilotNumber: number }>,
) {
  const round = await prisma.round.upsert({
    where: {
      competitionId_number_type: {
        competitionId,
        number: 1,
        type: RoundType.OFFICIAL,
      },
    },
    update: {
      status: RoundStatus.ACTIVE,
      startedAt: new Date('2024-11-16T09:00:00+05:45'),
    },
    create: {
      competitionId,
      number: 1,
      name: 'Round 1 – Official',
      type: RoundType.OFFICIAL,
      status: RoundStatus.ACTIVE,
      orderType: FlightOrderType.RANDOM,
      scheduledAt: new Date('2024-11-16T09:00:00+05:45'),
      startedAt: new Date('2024-11-16T09:00:00+05:45'),
      windDirection: 270,
      windSpeed: 3.2,
      notes: 'Random draw completed. Launch from Sarangkot.',
    },
  });

  const shuffled = shuffle(pilots);
  const flights: Array<{ id: string; pilotId: string; flightOrder: number }> = [];

  for (let i = 0; i < shuffled.length; i++) {
    const pilot = shuffled[i];
    const flight = await prisma.flight.upsert({
      where: {
        roundId_pilotId: { roundId: round.id, pilotId: pilot.id },
      },
      update: { flightOrder: i + 1 },
      create: {
        roundId: round.id,
        pilotId: pilot.id,
        flightOrder: i + 1,
        status: FlightStatus.PENDING,
      },
    });
    flights.push({ id: flight.id, pilotId: pilot.id, flightOrder: flight.flightOrder });
  }

  return { round, flights };
}

interface ScoreSpec {
  pilotNumber: number;
  resultType: ScoreResultType;
  distanceCm: number | null;
  finalScoreCm: number;
  isBullseye: boolean;
  status: FlightStatus;
}

const ROUND1_SCORES: ScoreSpec[] = [
  { pilotNumber: 1, resultType: ScoreResultType.BULLSEYE, distanceCm: 0, finalScoreCm: 0, isBullseye: true, status: FlightStatus.SCORED },
  { pilotNumber: 2, resultType: ScoreResultType.MEASURED, distanceCm: 45, finalScoreCm: 45, isBullseye: false, status: FlightStatus.SCORED },
  { pilotNumber: 3, resultType: ScoreResultType.MEASURED, distanceCm: 128, finalScoreCm: 128, isBullseye: false, status: FlightStatus.SCORED },
  { pilotNumber: 4, resultType: ScoreResultType.MEASURED, distanceCm: 312, finalScoreCm: 312, isBullseye: false, status: FlightStatus.SCORED },
  { pilotNumber: 5, resultType: ScoreResultType.BULLSEYE, distanceCm: 0, finalScoreCm: 0, isBullseye: true, status: FlightStatus.SCORED },
  { pilotNumber: 6, resultType: ScoreResultType.MEASURED, distanceCm: 67, finalScoreCm: 67, isBullseye: false, status: FlightStatus.SCORED },
  { pilotNumber: 7, resultType: ScoreResultType.DNF, distanceCm: null, finalScoreCm: 1000, isBullseye: false, status: FlightStatus.DNF },
  { pilotNumber: 8, resultType: ScoreResultType.MEASURED, distanceCm: 23, finalScoreCm: 23, isBullseye: false, status: FlightStatus.SCORED },
];

async function seedScores(
  roundId: string,
  flights: Array<{ id: string; pilotId: string; flightOrder: number }>,
  pilots: Array<{ id: string; pilotNumber: number }>,
  judgeId: string,
) {
  const pilotByNumber = new Map(pilots.map((p) => [p.pilotNumber, p.id]));
  const flightByPilotId = new Map(flights.map((f) => [f.pilotId, f]));

  for (const spec of ROUND1_SCORES) {
    const pilotId = pilotByNumber.get(spec.pilotNumber)!;
    const flight = flightByPilotId.get(pilotId)!;

    await prisma.flight.update({
      where: { id: flight.id },
      data: {
        status: spec.status,
        launchedAt: new Date('2024-11-16T09:30:00+05:45'),
        landedAt: spec.status === FlightStatus.DNF ? null : new Date('2024-11-16T09:35:00+05:45'),
      },
    });

    await prisma.score.upsert({
      where: { flightId: flight.id },
      update: {
        distanceCm: spec.distanceCm,
        resultType: spec.resultType,
        finalScoreCm: spec.finalScoreCm,
        isBullseye: spec.isBullseye,
        status: ScoreStatus.CONFIRMED,
      },
      create: {
        flightId: flight.id,
        roundId,
        pilotId,
        distanceCm: spec.distanceCm,
        resultType: spec.resultType,
        finalScoreCm: spec.finalScoreCm,
        isBullseye: spec.isBullseye,
        status: ScoreStatus.CONFIRMED,
        enteredById: judgeId,
        enteredAt: new Date('2024-11-16T09:36:00+05:45'),
        confirmedAt: new Date('2024-11-16T09:37:00+05:45'),
      },
    });
  }
}

async function seedSponsors(competitionId: string) {
  await prisma.sponsor.deleteMany({ where: { competitionId } });

  const sponsors = [
    { name: 'NPHA – Nepal Paragliding & Hang Gliding Association', tier: 'TITLE', displayOrder: 1 },
    { name: 'Visit Nepal 2024', tier: 'GOLD', displayOrder: 2 },
    { name: 'Pokhara Tourism Board', tier: 'GOLD', displayOrder: 3 },
    { name: 'Himalayan Outdoor Gear', tier: 'SILVER', displayOrder: 4 },
    { name: 'Annapurna Brewery', tier: 'STANDARD', displayOrder: 5 },
    { name: 'Lake City Hotel Pokhara', tier: 'STANDARD', displayOrder: 6 },
  ];

  for (const s of sponsors) {
    await prisma.sponsor.create({
      data: {
        competitionId,
        name: s.name,
        tier: s.tier,
        displayOrder: s.displayOrder,
        isActive: true,
      },
    });
  }
}

async function seedDisplayLayouts(competitionId: string) {
  const layouts = [
    {
      name: 'Current Pilot',
      type: 'CURRENT_PILOT',
      configJson: {
        showPilotPhoto: true,
        showCountryFlag: true,
        showGlider: true,
        showWind: true,
        fontSize: 'xl',
      },
      isDefault: true,
    },
    {
      name: 'Top 10 Individual',
      type: 'TOP10',
      configJson: {
        limit: 10,
        showCountry: true,
        showBullseyes: true,
        animateChanges: true,
      },
      isDefault: true,
    },
    {
      name: 'Top Teams',
      type: 'TOP_TEAMS',
      configJson: {
        limit: 8,
        showCountry: true,
        showRoundBreakdown: false,
      },
      isDefault: true,
    },
    {
      name: 'Sponsors Carousel',
      type: 'SPONSORS',
      configJson: {
        rotationIntervalSec: 8,
        showTier: true,
        background: 'navy',
      },
      isDefault: false,
    },
  ];

  for (const layout of layouts) {
    const existing = await prisma.displayLayout.findFirst({
      where: { competitionId, type: layout.type },
    });
    if (!existing) {
      await prisma.displayLayout.create({
        data: { competitionId, ...layout },
      });
    }
  }
}

async function seedWeather(competitionId: string) {
  await prisma.weather.deleteMany({ where: { competitionId } });
  await prisma.wind.deleteMany({ where: { competitionId } });

  await prisma.weather.create({
    data: {
      competitionId,
      temperatureC: 22.5,
      humidityPct: 68,
      pressureHpa: 1013.2,
      conditions: 'Partly cloudy, good visibility',
      recordedAt: new Date('2024-11-16T08:45:00+05:45'),
      source: 'MANUAL',
    },
  });

  await prisma.wind.create({
    data: {
      competitionId,
      directionDeg: 270,
      speedMs: 3.2,
      gustMs: 5.1,
      recordedAt: new Date('2024-11-16T08:45:00+05:45'),
      source: 'MANUAL',
    },
  });
}

async function main() {
  console.log('🌱 Seeding NPHA Accuracy CMS database...\n');

  const countryMap = await seedCountries();
  console.log(`✓ ${COUNTRIES.length} countries upserted`);

  const users = await seedUsers();
  console.log('✓ Staff users created (Super Admin, Director, Chief Judge, Judge, Scorekeeper)');

  const competition = await seedCompetition();
  console.log(`✓ Competition: ${competition.name}`);

  await seedCompetitionRoles(competition.id, users);
  console.log('✓ Competition role assignments');

  const pilots = await seedPilots(competition.id, countryMap);
  console.log(`✓ ${pilots.length} pilots registered`);

  await seedTeams(competition.id, countryMap, pilots);
  console.log('✓ 4 national teams (Nepal, India, France, Switzerland) with 4 members each');

  const { round, flights } = await seedRound1(competition.id, pilots);
  console.log(`✓ Round 1 (${RoundType.OFFICIAL}, ${RoundStatus.ACTIVE}) with random flight order`);

  const judgeId = users.get(Role.JUDGE)!;
  await seedScores(round.id, flights, pilots, judgeId);
  console.log('✓ Sample scores for pilots 1–8 (bullseyes, measured, 1 DNF)');

  await seedSponsors(competition.id);
  console.log('✓ Sponsors added');

  await seedDisplayLayouts(competition.id);
  console.log('✓ Display layouts (CURRENT_PILOT, TOP10, TOP_TEAMS, SPONSORS)');

  await seedWeather(competition.id);
  console.log('✓ Weather and wind readings');

  console.log('\n✅ Seed completed successfully.');
  console.log(`   Admin login: ${process.env.SEED_ADMIN_EMAIL ?? 'admin@npha.org.np'}`);
  console.log(`   Public slug: ${competition.publicSlug}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

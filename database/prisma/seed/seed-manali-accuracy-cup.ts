/**
 * Seed Manali Paragliding Association + 1st Solang Manali Accuracy Cup
 * Source: https://civlcomps.org/event/1st-solang-manali-accuracy-cup
 *
 * Run: node --env-file=../.env --import tsx prisma/seed/seed-manali-accuracy-cup.ts
 *   (from database/)
 */
import {
  PrismaClient,
  CompetitionStatus,
  RuleSetVersion,
  Role,
} from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_FAI_2022_RULES = {
  version: 'FAI_2022',
  bullseyeScoreCm: 0,
  maximumScoreCm: 1000,
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

const ORG_SLUG = 'manali-paragliding-association';
const COMP_CODE = 'SMAC-2026';
const COMP_SLUG = 'solang-manali-accuracy-cup-2026';

async function ensureIndia() {
  await prisma.country.upsert({
    where: { code: 'IND' },
    update: { name: 'India', code2: 'IN' },
    create: { code: 'IND', code2: 'IN', name: 'India' },
  });
}

async function seedOrganization() {
  const org = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    update: {
      name: 'Manali Paragliding Association',
      shortName: 'MPA',
      website: 'https://www.manaliparaglidingassociation.com',
      email: 'associationmanaliparagliding@gmail.com',
      country: 'India',
      city: 'Manali',
      state: 'Himachal Pradesh',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      isActive: true,
      status: 'ACTIVE',
    },
    create: {
      name: 'Manali Paragliding Association',
      shortName: 'MPA',
      slug: ORG_SLUG,
      description:
        'Organiser of the Solang Manali Accuracy Cup (PGA). Based in Solang Valley, Manali, Himachal Pradesh.',
      website: 'https://www.manaliparaglidingassociation.com',
      email: 'associationmanaliparagliding@gmail.com',
      phone: '+91 98161 91509',
      city: 'Manali',
      state: 'Himachal Pradesh',
      country: 'India',
      address: 'Solang Valley, Manali, Kullu, Himachal Pradesh 175103',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      primaryColor: '#0b1f33',
      secondaryColor: '#1e3a5f',
      accentColor: '#0ea5e9',
      defaultRuleProfile: RuleSetVersion.FAI_2022,
      status: 'ACTIVE',
      isActive: true,
      plan: 'PROFESSIONAL',
      maxCompetitions: 50,
      maxUsers: 100,
      settings: { create: {} },
    },
  });

  await prisma.organizationSettings.upsert({
    where: { organizationId: org.id },
    update: {},
    create: { organizationId: org.id },
  });

  return org;
}

async function seedOrgMembers(organizationId: string) {
  const emails = [
    'admin@npha.org.np',
    'director@npha.org.np',
    'chiefjudge@npha.org.np',
    'judge@npha.org.np',
    'scorer@npha.org.np',
  ];
  const roleByEmail: Record<string, 'ORGANIZATION_OWNER' | 'MEET_DIRECTOR' | 'CHIEF_JUDGE' | 'JUDGE' | 'SCORER'> = {
    'admin@npha.org.np': 'ORGANIZATION_OWNER',
    'director@npha.org.np': 'MEET_DIRECTOR',
    'chiefjudge@npha.org.np': 'CHIEF_JUDGE',
    'judge@npha.org.np': 'JUDGE',
    'scorer@npha.org.np': 'SCORER',
  };

  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true, role: true },
  });

  for (const user of users) {
    const orgRole = roleByEmail[user.email] ?? (user.role === Role.SUPER_ADMIN ? 'ORGANIZATION_OWNER' : 'VIEWER');
    await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: { organizationId, userId: user.id },
      },
      update: { role: orgRole, status: 'ACTIVE', joinedAt: new Date() },
      create: {
        organizationId,
        userId: user.id,
        role: orgRole,
        status: 'ACTIVE',
        joinedAt: new Date(),
      },
    });
  }

  return users.length;
}

async function seedCompetition(organizationId: string) {
  // CIVL: Oct 5–8, 2026 · Solang Manali, IND · trial round Day 1
  const startDate = new Date('2026-10-05T02:00:00.000Z'); // 07:30 IST check-in window
  const endDate = new Date('2026-10-08T12:30:00.000Z');

  const existing = await prisma.competition.findFirst({
    where: {
      OR: [{ code: COMP_CODE }, { publicSlug: COMP_SLUG }],
    },
  });

  const competitionData = {
    organizationId,
    name: '1st Solang Manali Accuracy Cup',
    code: COMP_CODE,
    organizer: 'Manali Paragliding Association',
    venue: 'Solang Valley, Manali',
    country: 'India',
    location: 'Solang Valley, Kullu, Himachal Pradesh 175103',
    latitude: 32.3167,
    longitude: 77.1556,
    startDate,
    endDate,
    practiceDays: 1,
    officialDays: 3,
    maxRounds: 12,
    practiceRounds: 1,
    targetDiameterCm: 200,
    ruleSet: RuleSetVersion.FAI_2022,
    status: CompetitionStatus.REGISTRATION,
    faiCategory: 'PGA',
    publicSlug: COMP_SLUG,
    isPublished: true,
    brandingJson: {
      primaryColor: '#0b1f33',
      accentColor: '#0ea5e9',
      logoText: 'SMAC 2026',
      civlEventUrl: 'https://civlcomps.org/event/1st-solang-manali-accuracy-cup',
      meetDirector: 'Bimal Adhikari',
      categories: ['PGA Overall', 'Team', 'Female'],
      maxPilots: 120,
    },
  };

  const competition = existing
    ? await prisma.competition.update({
        where: { id: existing.id },
        data: competitionData,
      })
    : await prisma.competition.create({
        data: competitionData,
      });

  await prisma.competitionSettings.upsert({
    where: { competitionId: competition.id },
    update: {
      womenCategoryEnabled: true,
      juniorCategoryEnabled: true,
      countryRankingEnabled: true,
      livePublicResults: true,
      discardWorstRounds: 1,
      discardAfterRounds: 5,
      teamSize: 4,
      teamScoringPilots: 3,
      teamAllowReserves: true,
      teamMaxReserves: 1,
      maximumScoreCm: 1000,
    },
    create: {
      competitionId: competition.id,
      womenCategoryEnabled: true,
      juniorCategoryEnabled: true,
      countryRankingEnabled: true,
      livePublicResults: true,
      discardWorstRounds: 1,
      discardAfterRounds: 5,
      teamSize: 4,
      teamScoringPilots: 3,
      teamAllowReserves: true,
      teamMaxReserves: 1,
      maximumScoreCm: 1000,
    },
  });

  await prisma.ruleProfile.upsert({
    where: { id: `${competition.id}-fai-2022` },
    update: { rulesJson: DEFAULT_FAI_2022_RULES },
    create: {
      id: `${competition.id}-fai-2022`,
      competitionId: competition.id,
      organizationId,
      name: 'FAI Sporting Code Section 7C (2022)',
      version: RuleSetVersion.FAI_2022,
      description: 'Default FAI accuracy rules for Solang Manali Accuracy Cup 2026',
      rulesJson: DEFAULT_FAI_2022_RULES,
      isDefault: true,
    },
  });

  return competition;
}

async function main() {
  console.log('Seeding Manali Paragliding Association + Solang Manali Accuracy Cup…');
  await ensureIndia();
  const org = await seedOrganization();
  console.log(`✓ Organization: ${org.name} (${org.slug}) id=${org.id}`);

  const memberCount = await seedOrgMembers(org.id);
  console.log(`✓ Organization members linked: ${memberCount}`);

  const competition = await seedCompetition(org.id);
  console.log(`✓ Competition: ${competition.name} (${competition.code})`);
  console.log(`  slug: ${competition.publicSlug}`);
  console.log(`  ${competition.startDate.toISOString().slice(0, 10)} → ${competition.endDate.toISOString().slice(0, 10)}`);
  console.log(`  venue: ${competition.venue}, ${competition.country}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

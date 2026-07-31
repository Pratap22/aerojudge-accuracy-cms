import type { RuleConfig, RuleSetVersion } from '@npha/shared';
import { slugify } from '@npha/utils';
import type { Prisma } from '@npha/database';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { organizationService } from '../modules/organization/index.js';

export async function listCompetitions(query: {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  organizationId?: string;
}) {
  const where: Prisma.CompetitionWhereInput = {};
  if (query.organizationId) where.organizationId = query.organizationId;
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { code: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  if (query.status) where.status = query.status as Prisma.EnumCompetitionStatusFilter['equals'];

  const [items, total] = await Promise.all([
    prisma.competition.findMany({
      where,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      orderBy: { startDate: 'desc' },
      include: { settings: true, organization: { select: { id: true, name: true, shortName: true, slug: true } } },
    }),
    prisma.competition.count({ where }),
  ]);

  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function getCompetition(id: string, organizationId?: string) {
  const competition = await prisma.competition.findUnique({
    where: { id },
    include: {
      settings: true,
      sponsors: true,
      organization: { select: { id: true, name: true, shortName: true, slug: true, logoUrl: true } },
    },
  });
  if (!competition) throw AppError.notFound('Competition not found');
  if (organizationId && competition.organizationId !== organizationId) {
    throw AppError.forbidden('Competition belongs to another organization');
  }
  return competition;
}

export async function createCompetition(data: {
  name: string;
  code: string;
  organizer: string;
  venue: string;
  country: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  startDate: Date;
  endDate: Date;
  practiceDays?: number;
  officialDays?: number;
  maxRounds?: number;
  practiceRounds?: number;
  targetDiameterCm?: number;
  maximumScoreCm?: number;
  ruleSet?: RuleSetVersion;
  faiCategory?: string;
  organizationId?: string;
}) {
  const { maximumScoreCm, organizationId: orgIdInput, ...competitionData } = data;
  // Prefer explicit caller context; fall back to resolve for legacy clients
  const organizationId =
    orgIdInput ?? (await organizationService.resolveOrganizationId(undefined));

  const slug = slugify(`${data.code}-${data.name}`);
  const existing = await prisma.competition.findFirst({
    where: { OR: [{ code: data.code }, { publicSlug: slug }] },
  });
  if (existing) throw AppError.conflict('Competition code or slug already exists');

  return prisma.competition.create({
    data: {
      ...competitionData,
      organizationId,
      publicSlug: slug,
      settings: {
        create: {
          ...(maximumScoreCm != null ? { maximumScoreCm } : {}),
        },
      },
    },
    include: { settings: true, organization: true },
  });
}

export async function updateCompetition(id: string, data: Record<string, unknown>) {
  await getCompetition(id);

  const {
    startDate,
    endDate,
    settings: _settings,
    id: _id,
    createdAt: _c,
    updatedAt: _u,
    publicSlug: _slug,
    maximumScoreCm,
    ...rest
  } = data;

  const updateData: Prisma.CompetitionUpdateInput = {
    ...rest,
  };

  if (startDate != null) {
    updateData.startDate = new Date(startDate as string | Date);
  }
  if (endDate != null) {
    updateData.endDate = new Date(endDate as string | Date);
  }

  if (maximumScoreCm != null && Number.isFinite(Number(maximumScoreCm))) {
    updateData.settings = {
      upsert: {
        create: { maximumScoreCm: Number(maximumScoreCm) },
        update: { maximumScoreCm: Number(maximumScoreCm) },
      },
    };
  }

  return prisma.competition.update({
    where: { id },
    data: updateData,
    include: { settings: true },
  });
}

export async function deleteCompetition(id: string): Promise<void> {
  await getCompetition(id);
  await prisma.competition.delete({ where: { id } });
}

export async function updateSettings(
  competitionId: string,
  data: Partial<RuleConfig> & Record<string, unknown>,
) {
  await getCompetition(competitionId);
  const { version: _v, customRules, tieBreakPriority, ...settingsFields } = data;

  const updateData: Prisma.CompetitionSettingsUpdateInput = {
    ...settingsFields,
    customRulesJson: customRules ? (customRules as object) : undefined,
    tieBreakRulesJson: tieBreakPriority ? (tieBreakPriority as object) : undefined,
  };

  const settings = await prisma.competitionSettings.upsert({
    where: { competitionId },
    create: { competitionId, ...updateData } as Prisma.CompetitionSettingsCreateInput,
    update: updateData,
  });

  // Keep all teams aligned with competition team composition rules
  await prisma.team.updateMany({
    where: { competitionId },
    data: {
      maxSize: settings.teamSize,
      scoringPilots: settings.teamScoringPilots,
      maxReserves: settings.teamAllowReserves ? settings.teamMaxReserves : 0,
    },
  });

  return settings;
}

export async function publishCompetition(id: string) {
  const competition = await getCompetition(id);
  if (competition.status === 'CANCELLED') {
    throw AppError.badRequest('Cannot publish a cancelled competition');
  }

  return prisma.competition.update({
    where: { id },
    data: {
      isPublished: true,
      status: competition.status === 'DRAFT' ? 'REGISTRATION' : competition.status,
    },
    include: { settings: true },
  });
}

/**
 * Mark the competition finished (e.g. weather stop).
 * Closes any in-progress rounds and sets status to COMPLETED.
 */
export async function completeCompetition(id: string) {
  const competition = await getCompetition(id);

  if (competition.status === 'COMPLETED') {
    return competition;
  }
  if (competition.status === 'CANCELLED' || competition.status === 'ARCHIVED') {
    throw AppError.badRequest(`Cannot complete a ${competition.status.toLowerCase()} competition`);
  }
  if (competition.status === 'DRAFT') {
    throw AppError.badRequest('Publish the competition before closing it');
  }

  const liveStatuses = ['ACTIVE', 'OPEN', 'PAUSED', 'BRIEFING'] as const;
  await prisma.round.updateMany({
    where: {
      competitionId: id,
      type: 'OFFICIAL',
      status: { in: [...liveStatuses] },
    },
    data: { status: 'CLOSED', closedAt: new Date() },
  });

  return prisma.competition.update({
    where: { id },
    data: { status: 'COMPLETED' },
    include: { settings: true },
  });
}

export function settingsToRuleOverrides(
  settings?: NonNullable<Awaited<ReturnType<typeof getCompetition>>['settings']> | null,
): Partial<RuleConfig> {
  if (!settings) return {};
  const overrides: Partial<RuleConfig> = {
    bullseyeScoreCm: settings.bullseyeScoreCm,
    maximumScoreCm: settings.maximumScoreCm,
    discardWorstRounds: settings.discardWorstRounds,
    discardAfterRounds: settings.discardAfterRounds,
    allowReflights: settings.allowReflights,
    maxReflightsPerRound: settings.maxReflightsPerRound,
    teamSize: settings.teamSize,
    teamScoringPilots: settings.teamScoringPilots,
    teamAllowReserves: settings.teamAllowReserves,
    teamMaxReserves: settings.teamMaxReserves,
    womenCategoryEnabled: settings.womenCategoryEnabled,
    juniorCategoryEnabled: settings.juniorCategoryEnabled,
    juniorMaxAge: settings.juniorMaxAge,
  };

  if (settings.customRulesJson && typeof settings.customRulesJson === 'object') {
    overrides.customRules = settings.customRulesJson as Record<string, unknown>;
  }
  if (Array.isArray(settings.tieBreakRulesJson)) {
    overrides.tieBreakPriority = settings.tieBreakRulesJson as RuleConfig['tieBreakPriority'];
  }

  return overrides;
}

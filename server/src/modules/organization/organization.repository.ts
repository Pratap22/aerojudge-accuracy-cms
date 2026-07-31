import type { Prisma } from '@npha/database';
import { prisma } from '../../config/prisma.js';
import type {
  CreateOrganizationInput,
  ListOrganizationsQuery,
  OrganizationSettingsInput,
  UpdateOrganizationInput,
} from './organization.types.js';

const orgInclude = {
  settings: true,
  _count: { select: { competitions: true, members: true } },
} satisfies Prisma.OrganizationInclude;

/**
 * Persistence layer for Organization aggregates.
 * Isolates Prisma access from application services (repository pattern).
 */
export class OrganizationRepository {
  constructor(private readonly db: typeof prisma = prisma) {}

  /**
   * Lists organizations with optional search/status filters and pagination.
   */
  async findMany(query: ListOrganizationsQuery) {
    const where: Prisma.OrganizationWhereInput = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { shortName: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
        { country: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.status) where.status = query.status;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const sortable = new Set(['name', 'shortName', 'slug', 'createdAt', 'updatedAt', 'status']);
    const sortField = sortable.has(query.sortBy ?? '') ? (query.sortBy as string) : 'name';
    const orderBy: Prisma.OrganizationOrderByWithRelationInput = {
      [sortField]: query.sortOrder ?? 'asc',
    };

    const [items, total] = await Promise.all([
      this.db.organization.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy,
        include: orgInclude,
      }),
      this.db.organization.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  /**
   * Finds an organization by primary key.
   */
  async findById(id: string) {
    return this.db.organization.findUnique({
      where: { id },
      include: orgInclude,
    });
  }

  /**
   * Finds an organization by unique slug.
   */
  async findBySlug(slug: string) {
    return this.db.organization.findUnique({
      where: { slug },
      include: orgInclude,
    });
  }

  /**
   * Returns the first active organization (fallback for competition create).
   */
  async findDefaultActive() {
    return this.db.organization.findFirst({
      where: { isActive: true, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      include: orgInclude,
    });
  }

  /**
   * Creates an organization with empty settings row.
   */
  async create(data: CreateOrganizationInput) {
    return this.db.organization.create({
      data: {
        name: data.name,
        shortName: data.shortName,
        slug: data.slug,
        description: data.description,
        website: data.website,
        email: data.email,
        phone: data.phone,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        timezone: data.timezone ?? 'UTC',
        currency: data.currency ?? 'USD',
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        accentColor: data.accentColor,
        brandingJson: data.brandingJson as Prisma.InputJsonValue | undefined,
        defaultRuleProfile: data.defaultRuleProfile ?? 'FAI_2022',
        plan: data.plan ?? 'FREE',
        featureFlags: data.featureFlags as Prisma.InputJsonValue | undefined,
        maxCompetitions: data.maxCompetitions ?? 10,
        maxUsers: data.maxUsers ?? 25,
        settings: { create: {} },
      },
      include: orgInclude,
    });
  }

  /**
   * Updates organization scalar/JSON fields.
   */
  async update(id: string, data: UpdateOrganizationInput) {
    const {
      brandingJson,
      featureFlags,
      ...rest
    } = data;

    const updateData: Prisma.OrganizationUpdateInput = { ...rest };
    if (brandingJson !== undefined) {
      updateData.brandingJson = brandingJson as Prisma.InputJsonValue;
    }
    if (featureFlags !== undefined) {
      updateData.featureFlags = featureFlags as Prisma.InputJsonValue;
    }

    return this.db.organization.update({
      where: { id },
      data: updateData,
      include: orgInclude,
    });
  }

  /**
   * Updates status / isActive flags.
   */
  async updateStatus(
    id: string,
    status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED',
    isActive?: boolean,
  ) {
    const derivedActive =
      isActive !== undefined ? isActive : status === 'ACTIVE';

    return this.db.organization.update({
      where: { id },
      data: { status, isActive: derivedActive },
      include: orgInclude,
    });
  }

  /**
   * Upserts organization settings JSON blobs.
   */
  async upsertSettings(organizationId: string, data: OrganizationSettingsInput) {
    const jsonFields = {
      generalJson: data.generalJson as Prisma.InputJsonValue | undefined,
      competitionDefaultsJson: data.competitionDefaultsJson as Prisma.InputJsonValue | undefined,
      printingDefaultsJson: data.printingDefaultsJson as Prisma.InputJsonValue | undefined,
      displayDefaultsJson: data.displayDefaultsJson as Prisma.InputJsonValue | undefined,
      certificatesJson: data.certificatesJson as Prisma.InputJsonValue | undefined,
      reportsJson: data.reportsJson as Prisma.InputJsonValue | undefined,
      ruleProfileJson: data.ruleProfileJson as Prisma.InputJsonValue | undefined,
      notificationDefaultsJson: data.notificationDefaultsJson as Prisma.InputJsonValue | undefined,
    };

    return this.db.organizationSettings.upsert({
      where: { organizationId },
      create: { organizationId, ...jsonFields },
      update: jsonFields,
    });
  }

  /**
   * Sets logo URL after upload.
   */
  async updateLogo(id: string, logoUrl: string) {
    return this.db.organization.update({
      where: { id },
      data: { logoUrl },
      include: orgInclude,
    });
  }

  /**
   * Counts competitions owned by an organization.
   */
  async countCompetitions(organizationId: string) {
    return this.db.competition.count({ where: { organizationId } });
  }

  /**
   * Lists competitions for an organization (paginated).
   */
  async findCompetitions(
    organizationId: string,
    query: { page: number; pageSize: number; search?: string },
  ) {
    const where: Prisma.CompetitionWhereInput = { organizationId };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.db.competition.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { startDate: 'desc' },
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
          startDate: true,
          endDate: true,
          venue: true,
          country: true,
          isPublished: true,
          publicSlug: true,
        },
      }),
      this.db.competition.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  /**
   * Soft-deletes by archiving when no hard delete is allowed.
   */
  async archive(id: string) {
    return this.updateStatus(id, 'ARCHIVED', false);
  }
}

/** Default repository instance for DI-friendly construction. */
export const organizationRepository = new OrganizationRepository();

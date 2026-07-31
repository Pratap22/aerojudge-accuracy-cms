import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/errors.js';
import {
  OrganizationRepository,
  organizationRepository,
} from './organization.repository.js';
import type {
  CreateOrganizationInput,
  ListOrganizationsQuery,
  OrganizationSettingsInput,
  UpdateOrganizationInput,
  UpdateOrganizationStatusInput,
} from './organization.types.js';
import { DEFAULT_ORGANIZATION_ID } from './organization.types.js';

/**
 * Application service for Organization management.
 * Encapsulates business rules; depends on OrganizationRepository (DIP).
 */
export class OrganizationService {
  constructor(private readonly repo: OrganizationRepository = organizationRepository) {}

  /**
   * Lists organizations with pagination and filters.
   * Non-platform users only see organizations they belong to.
   */
  async list(
    query: ListOrganizationsQuery & { memberUserId?: string; platformAdmin?: boolean },
  ) {
    const scoped = query.platformAdmin
      ? query
      : { ...query, memberUserId: query.memberUserId };
    return this.repo.findMany(scoped);
  }

  /**
   * Returns a single organization or throws NOT_FOUND.
   * When `memberUserId` is provided, enforces membership.
   */
  async getById(id: string, memberUserId?: string) {
    const org = await this.repo.findById(id);
    if (!org) throw AppError.notFound('Organization not found');
    if (memberUserId) {
      const membership = await prisma.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId: id, userId: memberUserId } },
      });
      if (!membership || membership.status === 'INACTIVE' || membership.status === 'SUSPENDED') {
        throw AppError.forbidden('Not a member of this organization');
      }
    }
    return org;
  }

  /**
   * Resolves organization id for competition create (explicit or default).
   */
  async resolveOrganizationId(organizationId?: string): Promise<string> {
    if (organizationId) {
      const org = await this.repo.findById(organizationId);
      if (!org) throw AppError.badRequest('Invalid organizationId');
      if (!org.isActive || org.status === 'ARCHIVED') {
        throw AppError.badRequest('Organization is not active');
      }
      return org.id;
    }

    const byMigrationId = await this.repo.findById(DEFAULT_ORGANIZATION_ID);
    if (byMigrationId?.isActive) return byMigrationId.id;

    const fallback = await this.repo.findDefaultActive();
    if (!fallback) {
      throw AppError.badRequest(
        'No active organization available. Create an organization first.',
      );
    }
    return fallback.id;
  }

  /**
   * Creates a new organization (unique slug).
   * Optionally seeds the creating user as ORGANIZATION_OWNER when `ownerUserId` is provided.
   */
  async create(data: CreateOrganizationInput, ownerUserId?: string) {
    const existing = await this.repo.findBySlug(data.slug);
    if (existing) throw AppError.conflict('Organization slug already exists');
    const org = await this.repo.create(data);
    if (ownerUserId) {
      await prisma.organizationMember.create({
        data: {
          organizationId: org.id,
          userId: ownerUserId,
          role: 'ORGANIZATION_OWNER',
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
      });
      const withOwner = await this.repo.findById(org.id);
      return withOwner ?? org;
    }
    return org;
  }

  /**
   * Updates organization profile / branding fields.
   */
  async update(id: string, data: UpdateOrganizationInput) {
    await this.getById(id);
    if (data.slug) {
      const existing = await this.repo.findBySlug(data.slug);
      if (existing && existing.id !== id) {
        throw AppError.conflict('Organization slug already exists');
      }
    }
    return this.repo.update(id, data);
  }

  /**
   * Activates, deactivates, or archives an organization.
   * Hard deletion is not supported; archive is the soft-delete path.
   */
  async updateStatus(id: string, data: UpdateOrganizationStatusInput) {
    await this.getById(id);
    return this.repo.updateStatus(id, data.status, data.isActive);
  }

  /**
   * Attempts hard delete — blocked when competitions exist.
   * Prefer archive via updateStatus for soft removal.
   */
  async assertCanDelete(id: string): Promise<void> {
    await this.getById(id);
    const count = await this.repo.countCompetitions(id);
    if (count > 0) {
      throw AppError.conflict(
        `Cannot delete organization with ${count} competition(s). Archive it instead.`,
      );
    }
  }

  /**
   * Updates organization settings (competition/print/display defaults, etc.).
   */
  async updateSettings(id: string, data: OrganizationSettingsInput) {
    await this.getById(id);
    const settings = await this.repo.upsertSettings(id, data);
    return { ...(await this.getById(id)), settings };
  }

  /**
   * Stores uploaded logo under uploads/organizations and updates logoUrl.
   */
  async uploadLogo(id: string, file: Express.Multer.File) {
    await this.getById(id);

    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowed.includes(file.mimetype)) {
      throw AppError.badRequest('Logo must be PNG, JPEG, WebP, or SVG');
    }

    const ext =
      file.mimetype === 'image/png'
        ? '.png'
        : file.mimetype === 'image/webp'
          ? '.webp'
          : file.mimetype === 'image/svg+xml'
            ? '.svg'
            : '.jpg';

    const dir = path.join(env.uploadDir, 'organizations', id);
    await mkdir(dir, { recursive: true });
    const filename = `logo${ext}`;
    const filePath = path.join(dir, filename);
    await writeFile(filePath, file.buffer);

    const logoUrl = `/uploads/organizations/${id}/${filename}`;
    return this.repo.updateLogo(id, logoUrl);
  }

  /**
   * Lists competitions owned by the organization.
   */
  async listCompetitions(
    id: string,
    query: { page: number; pageSize: number; search?: string },
  ) {
    await this.getById(id);
    return this.repo.findCompetitions(id, query);
  }
}

/** Default service instance (constructor DI with default repo). */
export const organizationService = new OrganizationService();

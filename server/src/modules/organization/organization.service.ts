import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env.js';
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
   */
  async list(query: ListOrganizationsQuery) {
    return this.repo.findMany(query);
  }

  /**
   * Returns a single organization or throws NOT_FOUND.
   */
  async getById(id: string) {
    const org = await this.repo.findById(id);
    if (!org) throw AppError.notFound('Organization not found');
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
   */
  async create(data: CreateOrganizationInput) {
    const existing = await this.repo.findBySlug(data.slug);
    if (existing) throw AppError.conflict('Organization slug already exists');
    return this.repo.create(data);
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

import type {
  CreateOrganizationRoleInput,
  UpdateOrganizationRoleInput,
} from '@npha/shared';
import { ALL_PERMISSIONS } from '@npha/shared';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/errors.js';

const ALLOWED = new Set<string>(ALL_PERMISSIONS);

function assertPermissions(permissions: string[]) {
  const invalid = permissions.filter((p) => !ALLOWED.has(p));
  if (invalid.length) {
    throw AppError.badRequest(`Unknown permissions: ${invalid.join(', ')}`);
  }
}

/**
 * Custom organization roles — named permission bundles per tenant.
 */
export class OrganizationRoleService {
  async list(organizationId: string) {
    return prisma.organizationRole.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
  }

  async getById(organizationId: string, roleId: string) {
    const role = await prisma.organizationRole.findFirst({
      where: { id: roleId, organizationId },
    });
    if (!role) throw AppError.notFound('Organization role not found');
    return role;
  }

  async create(organizationId: string, data: CreateOrganizationRoleInput) {
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw AppError.notFound('Organization not found');

    assertPermissions(data.permissions);

    const existing = await prisma.organizationRole.findUnique({
      where: {
        organizationId_key: { organizationId, key: data.key },
      },
    });
    if (existing) {
      throw AppError.conflict(`Role key "${data.key}" already exists in this organization`);
    }

    return prisma.organizationRole.create({
      data: {
        organizationId,
        key: data.key,
        name: data.name,
        description: data.description,
        permissions: data.permissions,
        basedOnOrgRole: data.basedOnOrgRole,
      },
    });
  }

  async update(
    organizationId: string,
    roleId: string,
    data: UpdateOrganizationRoleInput,
  ) {
    await this.getById(organizationId, roleId);
    if (data.permissions) assertPermissions(data.permissions);

    if (data.key) {
      const clash = await prisma.organizationRole.findFirst({
        where: {
          organizationId,
          key: data.key,
          NOT: { id: roleId },
        },
      });
      if (clash) {
        throw AppError.conflict(`Role key "${data.key}" already exists in this organization`);
      }
    }

    return prisma.organizationRole.update({
      where: { id: roleId },
      data: {
        ...(data.key !== undefined ? { key: data.key } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.permissions !== undefined ? { permissions: data.permissions } : {}),
        ...(data.basedOnOrgRole !== undefined ? { basedOnOrgRole: data.basedOnOrgRole } : {}),
      },
    });
  }

  async remove(organizationId: string, roleId: string) {
    await this.getById(organizationId, roleId);
    const assigned = await prisma.organizationMember.count({
      where: { organizationId, customRoleId: roleId, status: 'ACTIVE' },
    });
    if (assigned > 0) {
      throw AppError.conflict(
        'Cannot delete a role that is assigned to active members. Reassign members first.',
      );
    }
    await prisma.organizationRole.delete({ where: { id: roleId } });
    return { deleted: true };
  }
}

export const organizationRoleService = new OrganizationRoleService();

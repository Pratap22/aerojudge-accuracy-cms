import { randomBytes } from 'node:crypto';
import type {
  InviteOrganizationMemberInput,
  OrgRole,
  UpdateOrganizationMemberInput,
} from '@npha/shared';
import { mapLegacyRoleToOrgRole } from '@npha/shared';
import type { Prisma } from '@npha/database';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/errors.js';
import { hashPassword } from '../../services/auth.service.js';
import { resolveMembershipPermissions } from '../../auth/permissions.js';

async function countActiveOrgManagers(organizationId: string): Promise<number> {
  const members = await prisma.organizationMember.findMany({
    where: { organizationId, status: 'ACTIVE' },
    include: { customRole: { select: { permissions: true } } },
  });
  return members.filter((m) =>
    resolveMembershipPermissions({ role: m.role, customRole: m.customRole }).includes(
      'organization:manage',
    ),
  ).length;
}

function memberHasOrgManage(member: {
  role: OrgRole;
  customRole?: { permissions: unknown } | null;
}): boolean {
  return resolveMembershipPermissions({
    role: member.role,
    customRole: member.customRole,
  }).includes('organization:manage');
}

/**
 * Organization membership management (invite, role, deactivate).
 */
export class OrganizationMemberService {
  /**
   * Lists members of an organization.
   */
  async list(organizationId: string, query: { page: number; pageSize: number; search?: string }) {
    const where: Prisma.OrganizationMemberWhereInput = { organizationId };
    if (query.search) {
      where.user = {
        OR: [
          { email: { contains: query.search, mode: 'insensitive' } },
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }

    const [items, total] = await Promise.all([
      prisma.organizationMember.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              status: true,
              lastLoginAt: true,
            },
          },
          customRole: {
            select: { id: true, key: true, name: true, permissions: true },
          },
        },
      }),
      prisma.organizationMember.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  /**
   * Invites or adds a user to the organization. Creates the user if needed.
   */
  async invite(
    organizationId: string,
    data: InviteOrganizationMemberInput,
    invitedById: string,
  ) {
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw AppError.notFound('Organization not found');

    const email = data.email.toLowerCase();
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      if (!data.firstName || !data.lastName || !data.password) {
        throw AppError.badRequest(
          'firstName, lastName, and password are required when inviting a new user',
        );
      }
      const passwordHash = await hashPassword(data.password);
      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          role: 'PUBLIC_USER',
        },
      });
    }

    const existing = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } },
    });
    if (existing) {
      throw AppError.conflict('User is already a member of this organization');
    }

    return prisma.organizationMember.create({
      data: {
        organizationId,
        userId: user.id,
        role: data.role ?? 'VIEWER',
        status: 'ACTIVE',
        invitedById,
        joinedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
          },
        },
        customRole: {
          select: { id: true, key: true, name: true, permissions: true },
        },
      },
    });
  }

  /**
   * Updates member role, custom role, and/or status.
   */
  async update(
    organizationId: string,
    memberId: string,
    data: UpdateOrganizationMemberInput,
  ) {
    const member = await prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId },
      include: { customRole: { select: { permissions: true } } },
    });
    if (!member) throw AppError.notFound('Member not found');

    let customRoleId: string | null | undefined = data.customRoleId;
    let nextRole = data.role ?? member.role;

    if (customRoleId) {
      const custom = await prisma.organizationRole.findFirst({
        where: { id: customRoleId, organizationId },
      });
      if (!custom) throw AppError.badRequest('Custom role not found in this organization');
      if (custom.basedOnOrgRole) nextRole = custom.basedOnOrgRole;
    }

    const nextCustom =
      customRoleId === undefined
        ? member.customRole
        : customRoleId === null
          ? null
          : await prisma.organizationRole.findFirst({
              where: { id: customRoleId },
              select: { permissions: true },
            });

    const currentlyManages = memberHasOrgManage(member);
    const willManage = memberHasOrgManage({
      role: nextRole,
      customRole: nextCustom,
    });

    if (currentlyManages && !willManage) {
      const managers = await countActiveOrgManagers(organizationId);
      if (managers <= 1) {
        throw AppError.conflict(
          'Cannot remove organization:manage from the last member who has it',
        );
      }
    }

    if (data.status && data.status !== 'ACTIVE' && currentlyManages) {
      const managers = await countActiveOrgManagers(organizationId);
      if (managers <= 1) {
        throw AppError.conflict('Cannot deactivate the last organization manager');
      }
    }

    return prisma.organizationMember.update({
      where: { id: memberId },
      data: {
        ...(data.role || customRoleId !== undefined ? { role: nextRole } : {}),
        ...(customRoleId !== undefined ? { customRoleId } : {}),
        ...(data.status ? { status: data.status } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
          },
        },
        customRole: {
          select: { id: true, key: true, name: true, permissions: true },
        },
      },
    });
  }

  /**
   * Soft-removes a member (status INACTIVE).
   * Cannot remove the last member with organization:manage.
   */
  async remove(organizationId: string, memberId: string) {
    const member = await prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId },
      include: { customRole: { select: { permissions: true } } },
    });
    if (!member) throw AppError.notFound('Member not found');

    if (member.status === 'ACTIVE' && memberHasOrgManage(member)) {
      const managers = await countActiveOrgManagers(organizationId);
      if (managers <= 1) {
        throw AppError.conflict('Cannot remove the last organization manager');
      }
    }

    return prisma.organizationMember.update({
      where: { id: memberId },
      data: { status: 'INACTIVE' },
    });
  }

  /**
   * Ensures membership rows exist for seed/migration helpers.
   */
  async ensureMembership(
    organizationId: string,
    userId: string,
    role: OrgRole,
  ) {
    return prisma.organizationMember.upsert({
      where: { organizationId_userId: { organizationId, userId } },
      update: { role, status: 'ACTIVE', joinedAt: new Date() },
      create: {
        organizationId,
        userId,
        role,
        status: 'ACTIVE',
        joinedAt: new Date(),
      },
    });
  }
}

export const organizationMemberService = new OrganizationMemberService();

export { mapLegacyRoleToOrgRole, randomBytes };

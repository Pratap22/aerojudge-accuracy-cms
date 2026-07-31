import type { OrgRole, OrganizationMemberStatus, Permission, Role } from '@npha/shared';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: Role;
        organizationId?: string;
        orgRole?: OrgRole;
        permissions?: Permission[];
      };
      organizationId?: string;
      orgRole?: OrgRole;
      permissions?: Permission[];
      membership?: {
        id: string;
        organizationId: string;
        userId: string;
        role: OrgRole;
        status: OrganizationMemberStatus;
        customRoleId?: string | null;
      };
    }
  }
}

export {};

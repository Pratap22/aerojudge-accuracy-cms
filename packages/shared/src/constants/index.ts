import type { OrgRole, Role } from '../types';

/**
 * Legacy global role → permission matrix (backward compatible).
 * Prefer permission bundles + organization context for tenant APIs.
 */
export const PERMISSIONS = {
  'competition:create': ['SUPER_ADMIN', 'COMPETITION_DIRECTOR'],
  'competition:update': ['SUPER_ADMIN', 'COMPETITION_DIRECTOR'],
  'competition:delete': ['SUPER_ADMIN', 'COMPETITION_DIRECTOR'],
  'competition:publish': ['SUPER_ADMIN', 'COMPETITION_DIRECTOR'],
  'pilot:manage': ['SUPER_ADMIN', 'COMPETITION_DIRECTOR', 'SCOREKEEPER'],
  'team:manage': ['SUPER_ADMIN', 'COMPETITION_DIRECTOR', 'SCOREKEEPER'],
  'round:manage': ['SUPER_ADMIN', 'COMPETITION_DIRECTOR', 'CHIEF_JUDGE', 'JUDGE'],
  'round:start': ['SUPER_ADMIN', 'COMPETITION_DIRECTOR', 'CHIEF_JUDGE', 'JUDGE'],
  'round:close': ['SUPER_ADMIN', 'COMPETITION_DIRECTOR', 'CHIEF_JUDGE', 'JUDGE'],
  'score:enter': ['SUPER_ADMIN', 'CHIEF_JUDGE', 'JUDGE', 'SCOREKEEPER'],
  'score:confirm': ['SUPER_ADMIN', 'CHIEF_JUDGE', 'SCOREKEEPER'],
  'score:approve_chief': ['SUPER_ADMIN', 'CHIEF_JUDGE'],
  'score:approve_director': ['SUPER_ADMIN', 'COMPETITION_DIRECTOR'],
  'results:publish': ['SUPER_ADMIN', 'COMPETITION_DIRECTOR', 'CHIEF_JUDGE'],
  'print:generate': [
    'SUPER_ADMIN',
    'COMPETITION_DIRECTOR',
    'CHIEF_JUDGE',
    'SCOREKEEPER',
    'DISPLAY_OPERATOR',
  ],
  'print:approve': ['SUPER_ADMIN', 'COMPETITION_DIRECTOR', 'CHIEF_JUDGE'],
  'user:manage': ['SUPER_ADMIN'],
  'organization:read': ['SUPER_ADMIN', 'COMPETITION_DIRECTOR', 'PLATFORM_SUPPORT'],
  'organization:manage': ['SUPER_ADMIN'],
  'organization:members': ['SUPER_ADMIN', 'COMPETITION_DIRECTOR'],
  'organization:roles': ['SUPER_ADMIN', 'COMPETITION_DIRECTOR'],
  'platform:organizations': ['SUPER_ADMIN'],
  'platform:licenses': ['SUPER_ADMIN'],
  'platform:analytics': ['SUPER_ADMIN', 'PLATFORM_SUPPORT'],
  'display:control': ['SUPER_ADMIN', 'DISPLAY_OPERATOR', 'COMPETITION_DIRECTOR'],
  'announce': ['SUPER_ADMIN', 'ANNOUNCER', 'COMPETITION_DIRECTOR'],
  'weather:update': [
    'SUPER_ADMIN',
    'LAUNCH_MARSHAL',
    'GOAL_MARSHAL',
    'CHIEF_JUDGE',
    'COMPETITION_DIRECTOR',
  ],
  'audit:view': ['SUPER_ADMIN', 'COMPETITION_DIRECTOR', 'CHIEF_JUDGE'],
} as const;

export type Permission = keyof typeof PERMISSIONS;

/** All permission keys (for custom role editors / validation). */
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/** Platform-level roles (AeroJudge SaaS operators). SUPER_ADMIN = Platform Administrator. */
export const PLATFORM_ROLES: readonly Role[] = [
  'SUPER_ADMIN',
  'PLATFORM_SUPPORT',
  'PLATFORM_DEVELOPER',
] as const;

/** Built-in organization role keys (extensible via OrganizationRole custom rows). */
export const ORG_ROLES: OrgRole[] = [
  'ORGANIZATION_OWNER',
  'CHIEF_JUDGE',
  'MEET_DIRECTOR',
  'SCORER',
  'JUDGE',
  'ANNOUNCER',
  'DISPLAY_OPERATOR',
  'LAUNCH_MARSHAL',
  'GOAL_MARSHAL',
  'REGISTRATION_OFFICER',
  'VIEWER',
];

export interface OrgRoleDefinition {
  key: OrgRole;
  name: string;
  description: string;
  /** Permission bundle — source of truth for authorization checks. */
  permissions: readonly Permission[];
}

const VIEWER_PERMISSIONS: Permission[] = ['organization:read'];

const JUDGE_PERMISSIONS: Permission[] = [
  'score:enter',
  'round:manage',
  'round:start',
  'round:close',
];

const SCORER_PERMISSIONS: Permission[] = [
  ...VIEWER_PERMISSIONS,
  ...JUDGE_PERMISSIONS,
  'score:confirm',
  'pilot:manage',
  'team:manage',
  'print:generate',
];

const CHIEF_JUDGE_PERMISSIONS: Permission[] = [
  ...SCORER_PERMISSIONS,
  'round:manage',
  'round:start',
  'round:close',
  'score:approve_chief',
  'results:publish',
  'print:approve',
  'weather:update',
  'audit:view',
];

const MEET_DIRECTOR_PERMISSIONS: Permission[] = [
  ...VIEWER_PERMISSIONS,
  'competition:create',
  'competition:update',
  'competition:publish',
  'pilot:manage',
  'team:manage',
  'round:manage',
  'round:start',
  'round:close',
  'score:approve_director',
  'results:publish',
  'print:generate',
  'print:approve',
  'organization:members',
  'organization:roles',
  'display:control',
  'announce',
  'weather:update',
  'audit:view',
];

const OWNER_PERMISSIONS: Permission[] = [
  ...MEET_DIRECTOR_PERMISSIONS,
  'competition:delete',
  'organization:manage',
  'score:enter',
  'score:confirm',
  'score:approve_chief',
];

/**
 * System organization roles as permission bundles.
 * Custom org roles (DB) clone/extend these without code changes.
 */
export const SYSTEM_ORG_ROLE_DEFINITIONS: Record<OrgRole, OrgRoleDefinition> = {
  ORGANIZATION_OWNER: {
    key: 'ORGANIZATION_OWNER',
    name: 'Organization Owner',
    description: 'Full control within the organization',
    permissions: OWNER_PERMISSIONS,
  },
  MEET_DIRECTOR: {
    key: 'MEET_DIRECTOR',
    name: 'Meet Director',
    description: 'Competition director / meet director',
    permissions: MEET_DIRECTOR_PERMISSIONS,
  },
  CHIEF_JUDGE: {
    key: 'CHIEF_JUDGE',
    name: 'Chief Judge',
    description: 'Scoring oversight and chief approvals',
    permissions: CHIEF_JUDGE_PERMISSIONS,
  },
  SCORER: {
    key: 'SCORER',
    name: 'Scorer',
    description: 'Score confirmation and registration support',
    permissions: SCORER_PERMISSIONS,
  },
  JUDGE: {
    key: 'JUDGE',
    name: 'Judge',
    description: 'Enter flight scores',
    permissions: JUDGE_PERMISSIONS,
  },
  ANNOUNCER: {
    key: 'ANNOUNCER',
    name: 'Announcer',
    description: 'Live announcements',
    permissions: [...VIEWER_PERMISSIONS, 'announce'],
  },
  DISPLAY_OPERATOR: {
    key: 'DISPLAY_OPERATOR',
    name: 'Display Operator',
    description: 'Venue display control',
    permissions: [...VIEWER_PERMISSIONS, 'display:control', 'print:generate'],
  },
  LAUNCH_MARSHAL: {
    key: 'LAUNCH_MARSHAL',
    name: 'Launch Marshal',
    description: 'Launch / weather updates',
    permissions: [...VIEWER_PERMISSIONS, 'weather:update'],
  },
  GOAL_MARSHAL: {
    key: 'GOAL_MARSHAL',
    name: 'Goal Marshal',
    description: 'Goal / weather updates',
    permissions: [...VIEWER_PERMISSIONS, 'weather:update'],
  },
  REGISTRATION_OFFICER: {
    key: 'REGISTRATION_OFFICER',
    name: 'Registration Officer',
    description: 'Pilot and team registration',
    permissions: [...VIEWER_PERMISSIONS, 'pilot:manage', 'team:manage'],
  },
  VIEWER: {
    key: 'VIEWER',
    name: 'Viewer',
    description: 'Read-only organization access',
    permissions: VIEWER_PERMISSIONS,
  },
};

/**
 * @deprecated Prefer getPermissionsForOrgRole / permission bundles.
 * Inverted index kept for older call sites during transition.
 */
export const ORG_PERMISSIONS: Record<Permission, readonly OrgRole[]> = (() => {
  const inverted = {} as Record<Permission, OrgRole[]>;
  for (const permission of ALL_PERMISSIONS) {
    inverted[permission] = [];
  }
  for (const def of Object.values(SYSTEM_ORG_ROLE_DEFINITIONS)) {
    for (const permission of def.permissions) {
      inverted[permission].push(def.key);
    }
  }
  return inverted;
})();

/** Platform role → platform-only permissions. */
export const PLATFORM_PERMISSIONS: Partial<Record<Permission, readonly Role[]>> = {
  'platform:organizations': ['SUPER_ADMIN'],
  'platform:licenses': ['SUPER_ADMIN'],
  'platform:analytics': ['SUPER_ADMIN', 'PLATFORM_SUPPORT'],
  'user:manage': ['SUPER_ADMIN'],
};

export function isPlatformRole(role: Role): boolean {
  return (PLATFORM_ROLES as readonly string[]).includes(role);
}

export function hasPermission(role: Role, permission: Permission): boolean {
  const platformAllowed = PLATFORM_PERMISSIONS[permission];
  if (platformAllowed?.includes(role)) return true;
  const allowed = PERMISSIONS[permission] as readonly string[];
  return allowed.includes(role);
}

/** Returns the permission bundle for a built-in organization role. */
export function getPermissionsForOrgRole(orgRole: OrgRole): readonly Permission[] {
  return SYSTEM_ORG_ROLE_DEFINITIONS[orgRole]?.permissions ?? VIEWER_PERMISSIONS;
}

/**
 * Checks whether a permission is granted by a role's permission bundle
 * (or an explicit custom permission list).
 */
export function roleHasPermission(
  permissions: readonly Permission[] | readonly string[],
  permission: Permission,
): boolean {
  return (permissions as readonly string[]).includes(permission);
}

/**
 * Checks whether an organization role grants a permission via its bundle.
 */
export function hasOrgPermission(orgRole: OrgRole, permission: Permission): boolean {
  return roleHasPermission(getPermissionsForOrgRole(orgRole), permission);
}

/**
 * Effective permission check.
 * Prefer explicit `permissions` (from membership / custom role) when provided.
 */
export function hasEffectivePermission(input: {
  platformRole: Role;
  orgRole?: OrgRole | null;
  /** Resolved permission set for the active membership (system or custom role). */
  permissions?: readonly Permission[] | readonly string[] | null;
  permission: Permission;
}): boolean {
  const { platformRole, orgRole, permissions, permission } = input;

  if (permissions && roleHasPermission(permissions, permission)) return true;
  if (!permissions && orgRole && hasOrgPermission(orgRole, permission)) return true;

  const platformAllowed = PLATFORM_PERMISSIONS[permission];
  if (platformAllowed?.includes(platformRole)) return true;

  if (
    !orgRole &&
    !permissions &&
    !isPlatformRole(platformRole) &&
    !isPlatformOnlyPermission(permission) &&
    hasPermission(platformRole, permission)
  ) {
    return true;
  }
  return false;
}

export function isPlatformOnlyPermission(permission: Permission): boolean {
  return (
    permission === 'platform:organizations' ||
    permission === 'platform:licenses' ||
    permission === 'platform:analytics' ||
    permission === 'user:manage'
  );
}

/** Maps legacy User.role to OrgRole for membership migration. */
export function mapLegacyRoleToOrgRole(role: Role): OrgRole {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'ORGANIZATION_OWNER';
    case 'COMPETITION_DIRECTOR':
      return 'MEET_DIRECTOR';
    case 'CHIEF_JUDGE':
      return 'CHIEF_JUDGE';
    case 'SCOREKEEPER':
      return 'SCORER';
    case 'JUDGE':
      return 'JUDGE';
    case 'ANNOUNCER':
      return 'ANNOUNCER';
    case 'DISPLAY_OPERATOR':
      return 'DISPLAY_OPERATOR';
    case 'LAUNCH_MARSHAL':
      return 'LAUNCH_MARSHAL';
    case 'GOAL_MARSHAL':
      return 'GOAL_MARSHAL';
    default:
      return 'VIEWER';
  }
}

export const SOCKET_ROOMS = {
  competition: (id: string) => `competition:${id}`,
  round: (id: string) => `round:${id}`,
  display: (id: string) => `display:${id}`,
  public: (slug: string) => `public:${slug}`,
} as const;

export const API_VERSION = 'v1';
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

/** HTTP header for organization context (validated server-side; per-tab safe). */
export const ORGANIZATION_HEADER = 'x-organization-id';

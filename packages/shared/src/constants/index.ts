import type { Role } from '../types';

/** Permission matrix – FAI competition operations mapped to roles */
export const PERMISSIONS = {
  'competition:create': ['SUPER_ADMIN', 'COMPETITION_DIRECTOR'],
  'competition:update': ['SUPER_ADMIN', 'COMPETITION_DIRECTOR'],
  'competition:delete': ['SUPER_ADMIN'],
  'competition:publish': ['SUPER_ADMIN', 'COMPETITION_DIRECTOR'],
  'pilot:manage': ['SUPER_ADMIN', 'COMPETITION_DIRECTOR', 'SCOREKEEPER'],
  'team:manage': ['SUPER_ADMIN', 'COMPETITION_DIRECTOR', 'SCOREKEEPER'],
  'round:manage': ['SUPER_ADMIN', 'COMPETITION_DIRECTOR', 'CHIEF_JUDGE'],
  'round:start': ['SUPER_ADMIN', 'COMPETITION_DIRECTOR', 'CHIEF_JUDGE'],
  'round:close': ['SUPER_ADMIN', 'COMPETITION_DIRECTOR', 'CHIEF_JUDGE'],
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

export function hasPermission(role: Role, permission: Permission): boolean {
  const allowed = PERMISSIONS[permission] as readonly string[];
  return allowed.includes(role);
}

export const SOCKET_ROOMS = {
  competition: (id: string) => `competition:${id}`,
  round: (id: string) => `round:${id}`,
  display: (id: string) => `display:${id}`,
  public: (slug: string) => `public:${slug}`,
  announcer: (id: string) => `announcer:${id}`,
  broadcast: (id: string) => `broadcast:${id}`,
} as const;

export const API_VERSION = 'v1';
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

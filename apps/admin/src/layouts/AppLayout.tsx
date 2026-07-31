import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  BarChart3,
  ClipboardList,
  FileText,
  Gauge,
  LayoutDashboard,
  LogOut,
  Medal,
  Moon,
  Settings,
  Shield,
  Sun,
  Target,
  Trophy,
  Users,
  UsersRound,
  Building2,
  Handshake,
} from 'lucide-react';
import { Badge, Button, cn } from '@npha/ui';
import { hasEffectivePermission, hasPermission, isPlatformRole, type Permission } from '@npha/shared';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { api } from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';
import { competitionPath } from '../hooks/useCompetitionId';
import { checkPermission } from '../hooks/usePermission';

const globalNav = [
  { to: '/competitions', label: 'Competitions', icon: Trophy, end: true },
  { to: '/organizations', label: 'Organizations', icon: Building2, end: false },
  { to: '/users', label: 'Judges / Users', icon: Shield, end: false },
] as const;

/** Competition tabs — gated by org permissions (Judge → Scoring only). */
const competitionNav: Array<{
  segment: string;
  label: string;
  icon: typeof LayoutDashboard;
  end: boolean;
  anyOf: readonly Permission[];
}> = [
  {
    segment: '',
    label: 'Overview',
    icon: LayoutDashboard,
    end: true,
    anyOf: ['competition:update', 'competition:publish', 'round:manage'],
  },
  { segment: 'pilots', label: 'Pilots', icon: Users, end: false, anyOf: ['pilot:manage'] },
  { segment: 'teams', label: 'Teams', icon: UsersRound, end: false, anyOf: ['team:manage'] },
  {
    segment: 'sponsors',
    label: 'Sponsors',
    icon: Handshake,
    end: false,
    anyOf: ['competition:update'],
  },
  {
    segment: 'rounds',
    label: 'Rounds',
    icon: Target,
    end: false,
    anyOf: ['round:manage', 'round:start', 'round:close'],
  },
  { segment: 'scoring', label: 'Scoring', icon: Gauge, end: false, anyOf: ['score:enter', 'score:confirm'] },
  {
    segment: 'rankings',
    label: 'Rankings',
    icon: Medal,
    end: false,
    anyOf: ['results:publish', 'score:confirm', 'round:manage', 'print:generate'],
  },
  {
    segment: 'reports',
    label: 'Reports / Print',
    icon: FileText,
    end: false,
    anyOf: ['print:generate'],
  },
  {
    segment: 'statistics',
    label: 'Statistics',
    icon: BarChart3,
    end: false,
    anyOf: ['results:publish', 'score:confirm', 'audit:view', 'print:generate'],
  },
  { segment: 'audit', label: 'Audit', icon: ClipboardList, end: false, anyOf: ['audit:view'] },
  {
    segment: 'settings',
    label: 'Settings',
    icon: Settings,
    end: false,
    anyOf: ['competition:update'],
  },
];

function competitionIdFromPath(pathname: string): string | undefined {
  const match = pathname.match(/^\/competitions\/([^/]+)/);
  return match?.[1];
}

export function AppLayout() {
  const { user, logout, currentOrganization, organizations, selectOrganization } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const competitionId = useMemo(() => competitionIdFromPath(pathname), [pathname]);

  const visibleGlobalNav = useMemo(() => {
    if (!user) return [];
    return globalNav.filter((item) => {
      if (item.to === '/users') {
        return hasPermission(user.role, 'user:manage');
      }
      if (item.to === '/organizations') {
        return (
          hasEffectivePermission({
            platformRole: user.role,
            orgRole: user.orgRole,
            permissions: user.permissions,
            permission: 'organization:manage',
          }) ||
          hasEffectivePermission({
            platformRole: user.role,
            orgRole: user.orgRole,
            permissions: user.permissions,
            permission: 'organization:members',
          }) ||
          hasEffectivePermission({
            platformRole: user.role,
            orgRole: user.orgRole,
            permissions: user.permissions,
            permission: 'organization:read',
          }) ||
          hasPermission(user.role, 'platform:organizations') ||
          isPlatformRole(user.role)
        );
      }
      return true;
    });
  }, [user]);

  const visibleCompetitionNav = useMemo(() => {
    if (!user) return [];
    return competitionNav.filter((item) =>
      item.anyOf.some((permission) => checkPermission(user, permission)),
    );
  }, [user]);

  const { data: competitions } = useQuery({
    queryKey: ['competitions'],
    queryFn: () => api.get<Array<{ id: string; name: string; code: string }>>('/competitions'),
  });

  const activeCompetition = competitions?.find((c) => c.id === competitionId);

  useEffect(() => {
    if (competitionId) {
      connectSocket(competitionId);
      return () => {
        disconnectSocket();
      };
    }
    return undefined;
  }, [competitionId]);

  const roleLabel =
    currentOrganization?.customRoleName ??
    currentOrganization?.role ??
    user?.orgRole ??
    user?.role;

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-sidebar text-sidebar-foreground">
        <div className="border-b border-white/10 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <Target className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold tracking-wide">AeroJudge</p>
              <p className="truncate text-xs text-sidebar-foreground/70">
                {currentOrganization
                  ? currentOrganization.shortName
                  : activeCompetition
                    ? `${activeCompetition.code} · Active`
                    : 'Select an organization'}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 scrollbar-thin">
          {visibleGlobalNav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-sidebar-foreground/80 hover:bg-white/10 hover:text-sidebar-foreground',
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}

          {competitionId && visibleCompetitionNav.length > 0 && (
            <>
              <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                Competition
              </p>
              {visibleCompetitionNav.map(({ segment, label, icon: Icon, end }) => (
                <NavLink
                  key={segment || 'overview'}
                  to={competitionPath(competitionId, segment)}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-secondary text-secondary-foreground'
                        : 'text-sidebar-foreground/80 hover:bg-white/10 hover:text-sidebar-foreground',
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        <div className="border-t border-white/10 p-4">
          {organizations.length > 0 && (
            <div className="mb-3 space-y-1">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                Organization
              </p>
              <select
                className="w-full rounded-md border border-white/20 bg-transparent px-2 py-1.5 text-xs text-sidebar-foreground"
                aria-label="Current organization"
                value={currentOrganization?.organizationId ?? ''}
                onChange={(e) => {
                  const id = e.target.value;
                  if (id) void selectOrganization(id);
                }}
              >
                {organizations
                  .filter((o) => o.status === 'ACTIVE')
                  .map((o) => (
                    <option key={o.organizationId} value={o.organizationId} className="text-foreground">
                      {o.shortName} — {o.name}
                    </option>
                  ))}
              </select>
            </div>
          )}
          <div className="mb-3 flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {user?.firstName} {user?.lastName}
              </p>
              <Badge variant="secondary" className="mt-1 text-[10px]">
                {(roleLabel ?? 'USER').replace(/_/g, ' ')}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="text-sidebar-foreground hover:bg-white/10"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full border-white/20 bg-transparent text-sidebar-foreground hover:bg-white/10"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <main className="ml-64 flex-1">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="min-h-screen p-6 lg:p-8"
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}

/** First competition sub-path the user is allowed to open (Judges → rounds). */
export function defaultCompetitionSegment(user: Parameters<typeof checkPermission>[0]): string {
  if (checkPermission(user, 'competition:update')) {
    return '';
  }
  if (
    checkPermission(user, 'round:manage') ||
    checkPermission(user, 'round:start') ||
    checkPermission(user, 'round:close')
  ) {
    return 'rounds';
  }
  if (checkPermission(user, 'score:enter') || checkPermission(user, 'score:confirm')) {
    return 'scoring';
  }
  if (checkPermission(user, 'pilot:manage')) return 'pilots';
  if (checkPermission(user, 'print:generate')) return 'reports';
  return '';
}

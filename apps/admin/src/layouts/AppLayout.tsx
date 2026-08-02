import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
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
import { hasEffectivePermission, hasPermission, type Permission } from '@npha/shared';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { api } from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';
import { competitionPath } from '../hooks/useCompetitionId';
import { checkPermission } from '../hooks/usePermission';

const platformNav = [
  { to: '/competitions', label: 'Competitions', icon: Trophy, end: true },
  { to: '/organizations', label: 'Organizations', icon: Building2, end: true },
  { to: '/users', label: 'Users', icon: Shield, end: false },
] as const;

type CompetitionNavItem = {
  segment: string;
  label: string;
  icon: typeof LayoutDashboard;
  end: boolean;
  anyOf: readonly Permission[];
};

/** Competition tools — grouped for clearer scanning. */
const competitionNavGroups: Array<{
  title: string;
  items: CompetitionNavItem[];
}> = [
  {
    title: 'Event',
    items: [
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
        label: 'Partners',
        icon: Handshake,
        end: false,
        anyOf: ['competition:update'],
      },
    ],
  },
  {
    title: 'Scoring',
    items: [
      {
        segment: 'rounds',
        label: 'Rounds',
        icon: Target,
        end: false,
        anyOf: ['round:manage', 'round:start', 'round:close'],
      },
      {
        segment: 'scoring',
        label: 'Enter scores',
        icon: Gauge,
        end: false,
        anyOf: ['score:enter', 'score:confirm'],
      },
    ],
  },
  {
    title: 'Results',
    items: [
      {
        segment: 'rankings',
        label: 'Rankings',
        icon: Medal,
        end: false,
        anyOf: ['results:publish', 'score:confirm', 'round:manage', 'print:generate'],
      },
      {
        segment: 'reports',
        label: 'Reports',
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
    ],
  },
  {
    title: 'Admin',
    items: [
      { segment: 'audit', label: 'Audit log', icon: ClipboardList, end: false, anyOf: ['audit:view'] },
      {
        segment: 'settings',
        label: 'Settings',
        icon: Settings,
        end: false,
        anyOf: ['competition:update'],
      },
    ],
  },
];

function competitionIdFromPath(pathname: string): string | undefined {
  const match = pathname.match(/^\/competitions\/([^/]+)/);
  const id = match?.[1];
  if (!id || id === 'archived') return undefined;
  return id;
}

function NavSectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 pb-1.5 pt-4 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
      {children}
    </p>
  );
}

function SidebarLink({
  to,
  end,
  icon: Icon,
  children,
}: {
  to: string;
  end?: boolean;
  icon: typeof LayoutDashboard;
  children: ReactNode;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-secondary text-secondary-foreground'
            : 'text-sidebar-foreground/80 hover:bg-white/10 hover:text-sidebar-foreground',
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0 opacity-90" />
      <span className="truncate">{children}</span>
    </NavLink>
  );
}

export function AppLayout() {
  const { user, logout, currentOrganization, organizations, selectOrganization } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const competitionId = useMemo(() => competitionIdFromPath(pathname), [pathname]);

  const visiblePlatformNav = useMemo(() => {
    if (!user) return [];
    return platformNav.filter((item) => {
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
          hasPermission(user.role, 'platform:organizations')
        );
      }
      return true;
    });
  }, [user]);

  const visibleCompetitionGroups = useMemo(() => {
    if (!user) return [];
    return competitionNavGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          item.anyOf.some((permission) => checkPermission(user, permission)),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [user]);

  const { data: competitions } = useQuery({
    queryKey: ['competitions'],
    queryFn: () =>
      api.get<Array<{ id: string; name: string; code: string; status: string }>>('/competitions'),
  });

  const activeCompetition = competitions?.find((c) => c.id === competitionId);
  const inCompetition = Boolean(competitionId && visibleCompetitionGroups.length > 0);

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
        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
              <Target className="h-4 w-4 text-secondary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold tracking-wide">AeroJudge</p>
              <p className="truncate text-xs text-sidebar-foreground/65">
                {currentOrganization?.shortName ?? 'Admin'}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3 scrollbar-thin">
          {inCompetition ? (
            <>
              <div className="mb-2 rounded-lg border border-white/10 bg-white/5 p-3">
                <button
                  type="button"
                  onClick={() => navigate('/competitions')}
                  className="mb-2 inline-flex items-center gap-1 text-[11px] font-medium text-sidebar-foreground/60 transition-colors hover:text-sidebar-foreground"
                >
                  <ArrowLeft className="h-3 w-3" />
                  All competitions
                </button>
                <p className="truncate text-sm font-semibold leading-snug text-sidebar-foreground">
                  {activeCompetition?.name ?? 'Competition'}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-sidebar-foreground/55">
                  {activeCompetition
                    ? `${activeCompetition.code} · ${activeCompetition.status.replace(/_/g, ' ')}`
                    : 'Loading…'}
                </p>
              </div>

              {visibleCompetitionGroups.map((group) => (
                <div key={group.title}>
                  <NavSectionLabel>{group.title}</NavSectionLabel>
                  <div className="space-y-0.5">
                    {group.items.map(({ segment, label, icon, end }) => (
                      <SidebarLink
                        key={segment || 'overview'}
                        to={competitionPath(competitionId!, segment)}
                        end={end}
                        icon={icon}
                      >
                        {label}
                      </SidebarLink>
                    ))}
                  </div>
                </div>
              ))}

              <NavSectionLabel>Workspace</NavSectionLabel>
              <div className="space-y-0.5 opacity-80">
                {visiblePlatformNav.map(({ to, label, icon, end }) => (
                  <SidebarLink key={to} to={to} end={end} icon={icon}>
                    {label}
                  </SidebarLink>
                ))}
              </div>
            </>
          ) : (
            <>
              <NavSectionLabel>Workspace</NavSectionLabel>
              <div className="space-y-0.5">
                {visiblePlatformNav.map(({ to, label, icon, end }) => (
                  <SidebarLink key={to} to={to} end={end} icon={icon}>
                    {label}
                  </SidebarLink>
                ))}
              </div>
            </>
          )}
        </nav>

        <div className="border-t border-white/10 p-4">
          {organizations.length > 0 && (
            <div className="mb-3 space-y-1">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
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

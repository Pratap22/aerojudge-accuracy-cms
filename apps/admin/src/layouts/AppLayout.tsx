import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  BarChart3,
  Building2,
  ClipboardList,
  FileText,
  Gauge,
  Gavel,
  Handshake,
  Info,
  LayoutDashboard,
  LogOut,
  Medal,
  Menu,
  Moon,
  Settings,
  Shield,
  Sun,
  Target,
  Trophy,
  Users,
  UsersRound,
  UserCheck,
  X,
} from 'lucide-react';
import { Badge, Button, cn } from '@npha/ui';
import { hasEffectivePermission, hasPermission, type Permission } from '@npha/shared';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { api } from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';
import { competitionPath, competitionsListPath, parseCompetitionLocation } from '../hooks/useCompetitionId';
import { checkPermission } from '../hooks/usePermission';
import { SwitchToScoringButton } from '../components/SwitchToScoringButton';

const platformNavBase = [
  { key: 'competitions' as const, label: 'Competitions', icon: Trophy, end: true },
  { key: 'organizations' as const, to: '/organizations', label: 'Organizations', icon: Building2, end: true },
  { key: 'profile-claims' as const, to: '/profile-claims', label: 'Profile claims', icon: UserCheck, end: false },
  { key: 'users' as const, to: '/users', label: 'Users', icon: Shield, end: false },
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
      {
        segment: 'officials',
        label: 'Officials',
        icon: Gavel,
        end: false,
        anyOf: ['competition:update'],
      },
      {
        segment: 'info',
        label: 'Event info',
        icon: Info,
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

function NavSectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50 first:pt-1">
      {children}
    </p>
  );
}

function SidebarLink({
  to,
  end,
  icon: Icon,
  children,
  onNavigate,
}: {
  to: string;
  end?: boolean;
  icon: typeof LayoutDashboard;
  children: ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors lg:min-h-0 lg:py-2',
          isActive
            ? 'bg-sidebar-accent text-sidebar-foreground'
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
  const {
    user,
    logout,
    currentOrganization,
    organizations,
    selectOrganization,
    activeOrganizationId,
  } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const [navOpen, setNavOpen] = useState(false);
  const routeIds = useMemo(() => parseCompetitionLocation(pathname), [pathname]);
  const competitionId = routeIds.competitionId;
  const routeOrganizationId = routeIds.organizationId;
  const orgScope = activeOrganizationId ?? user?.organizationId ?? null;

  const visiblePlatformNav = useMemo(() => {
    if (!user) return [];
    return platformNavBase
      .filter((item) => {
        if (item.key === 'users') {
          return hasPermission(user.role, 'user:manage');
        }
        if (item.key === 'profile-claims') {
          return checkPermission(user, 'pilot:manage');
        }
        if (item.key === 'organizations') {
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
      })
      .map((item) => {
        if (item.key === 'competitions') {
          return {
            ...item,
            to: orgScope ? competitionsListPath(orgScope) : '/competitions',
          };
        }
        return item;
      });
  }, [user, orgScope]);

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
    queryKey: ['competitions', orgScope ?? 'none'],
    queryFn: () =>
      api.get<
        Array<{ id: string; name: string; code: string; status: string; organizationId?: string }>
      >('/competitions'),
    // Wait for org header — missing x-organization-id returns an empty list.
    // Also wait until URL org matches active org so we don't cache the wrong tenant's list.
    enabled:
      !!orgScope && (!routeOrganizationId || routeOrganizationId === activeOrganizationId),
  });

  const activeCompetition = competitions?.find((c) => c.id === competitionId);
  const competitionBelongsToOrg =
    !competitionId || !competitions || competitions.some((c) => c.id === competitionId);
  const inCompetition = Boolean(
    competitionId && activeCompetition && visibleCompetitionGroups.length > 0,
  );
  const navOrganizationId =
    routeOrganizationId ?? orgScope ?? activeCompetition?.organizationId ?? undefined;

  // Close mobile drawer on route change
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  // Body scroll lock while drawer open
  useEffect(() => {
    if (!navOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [navOpen]);

  // Escape closes drawer
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  // Align selected org with the organization id in the URL (shareable deep links)
  useEffect(() => {
    if (!routeOrganizationId) return;
    if (routeOrganizationId === activeOrganizationId) return;
    const membership = organizations.find(
      (o) => o.organizationId === routeOrganizationId && o.status === 'ACTIVE',
    );
    if (!membership) return;
    let cancelled = false;
    void (async () => {
      await selectOrganization(routeOrganizationId);
      if (cancelled) return;
      await queryClient.cancelQueries();
      queryClient.clear();
    })();
    return () => {
      cancelled = true;
    };
  }, [
    routeOrganizationId,
    activeOrganizationId,
    organizations,
    selectOrganization,
    queryClient,
  ]);

  // Leave competition routes that are not part of the active organization
  useEffect(() => {
    if (!competitionId || !competitions || !orgScope) return;
    // Don't bounce while URL org is still being selected
    if (routeOrganizationId && routeOrganizationId !== activeOrganizationId) return;
    if (!competitions.some((c) => c.id === competitionId)) {
      disconnectSocket();
      navigate(competitionsListPath(orgScope), { replace: true });
    }
  }, [
    competitionId,
    competitions,
    navigate,
    orgScope,
    routeOrganizationId,
    activeOrganizationId,
  ]);

  useEffect(() => {
    if (competitionId && competitionBelongsToOrg && activeCompetition) {
      connectSocket(competitionId);
      return () => {
        disconnectSocket();
      };
    }
    return undefined;
  }, [competitionId, competitionBelongsToOrg, activeCompetition]);

  const handleOrganizationChange = async (organizationId: string) => {
    if (!organizationId || organizationId === activeOrganizationId) return;
    await selectOrganization(organizationId);
    await queryClient.cancelQueries();
    queryClient.clear();
    navigate(competitionsListPath(organizationId), { replace: true });
  };

  const roleLabel =
    currentOrganization?.customRoleName ??
    currentOrganization?.role ??
    user?.orgRole ??
    user?.role;

  const closeNav = () => setNavOpen(false);

  const mobileTitle = inCompetition
    ? (activeCompetition?.name ?? 'Competition')
    : (currentOrganization?.shortName ?? 'AeroJudge');

  const sidebarNav = (
    <>
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5 lg:px-5 lg:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent">
            <Target className="h-4 w-4 text-sidebar-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-wide">AeroJudge</p>
            <p className="truncate text-xs text-sidebar-foreground/65">
              {currentOrganization?.shortName ?? 'Admin'}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 text-sidebar-foreground hover:bg-white/10 lg:hidden"
          onClick={closeNav}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-2.5 py-3 scrollbar-thin lg:px-3">
        {inCompetition ? (
          <>
            <div className="mb-2 rounded-lg border border-white/10 bg-white/5 p-3">
              <button
                type="button"
                onClick={() => {
                  closeNav();
                  if (navOrganizationId) navigate(competitionsListPath(navOrganizationId));
                  else navigate('/competitions');
                }}
                className="mb-2 inline-flex min-h-9 items-center gap-1 text-[11px] font-medium text-sidebar-foreground/60 transition-colors hover:text-sidebar-foreground"
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
                      to={
                        navOrganizationId && competitionId
                          ? competitionPath(navOrganizationId, competitionId, segment)
                          : '#'
                      }
                      end={end}
                      icon={icon}
                      onNavigate={closeNav}
                    >
                      {label}
                    </SidebarLink>
                  ))}
                </div>
              </div>
            ))}

            <NavSectionLabel>Workspace</NavSectionLabel>
            <div className="space-y-0.5 opacity-90">
              {visiblePlatformNav.map(({ to, label, icon, end }) => (
                <SidebarLink key={to} to={to} end={end} icon={icon} onNavigate={closeNav}>
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
                <SidebarLink key={to} to={to} end={end} icon={icon} onNavigate={closeNav}>
                  {label}
                </SidebarLink>
              ))}
            </div>
          </>
        )}
      </nav>

      <div className="border-t border-white/10 p-3 lg:p-4">
        {organizations.length > 0 && (
          <div className="mb-3 space-y-1">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              Organization
            </p>
            <select
              className="w-full min-h-10 rounded-md border border-white/20 bg-sidebar px-2 py-2 text-xs text-sidebar-foreground"
              aria-label="Current organization"
              value={currentOrganization?.organizationId ?? activeOrganizationId ?? ''}
              onChange={(e) => {
                const id = e.target.value;
                if (id) void handleOrganizationChange(id);
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
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {user?.firstName} {user?.lastName}
            </p>
            <Badge variant="secondary" className="mt-1 max-w-full truncate text-[10px]">
              {(roleLabel ?? 'USER').replace(/_/g, ' ')}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="shrink-0 text-sidebar-foreground hover:bg-white/10"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
        <SwitchToScoringButton
          className="mb-2 min-h-10 w-full border-white/20 bg-transparent text-sidebar-foreground hover:bg-white/10"
          onNavigate={closeNav}
        />
        <Button
          variant="outline"
          size="sm"
          className="min-h-10 w-full border-white/20 bg-transparent text-sidebar-foreground hover:bg-white/10"
          onClick={() => {
            closeNav();
            logout();
            navigate('/login');
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile overlay */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden',
          navOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-hidden={!navOpen}
        onClick={closeNav}
      />

      {/* Sidebar — off-canvas on mobile, fixed on desktop */}
      <aside
        id="admin-sidebar"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[min(18rem,88vw)] flex-col bg-sidebar text-sidebar-foreground shadow-xl transition-transform duration-200 ease-out lg:w-64 lg:shadow-none',
          navOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
        aria-label="Main navigation"
      >
        {sidebarNav}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:ml-64">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
            aria-expanded={navOpen}
            aria-controls="admin-sidebar"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight">{mobileTitle}</p>
            {inCompetition && activeCompetition ? (
              <p className="truncate text-xs text-muted-foreground">
                {activeCompetition.status.replace(/_/g, ' ')}
              </p>
            ) : (
              <p className="truncate text-xs text-muted-foreground">Admin</p>
            )}
          </div>
          <SwitchToScoringButton compact variant="ghost" className="shrink-0" />
        </header>

        <main className="min-w-0 flex-1">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="mx-auto min-h-[calc(100vh-3.5rem)] w-full max-w-7xl p-4 sm:p-6 lg:min-h-screen lg:p-8"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
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

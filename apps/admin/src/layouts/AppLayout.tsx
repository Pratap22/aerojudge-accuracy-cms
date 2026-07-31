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
} from 'lucide-react';
import { Badge, Button, cn } from '@npha/ui';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { api } from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';
import { competitionPath } from '../hooks/useCompetitionId';

const globalNav = [
  { to: '/competitions', label: 'Competitions', icon: Trophy, end: true },
  { to: '/users', label: 'Judges / Users', icon: Shield, end: false },
];

const competitionNav = [
  { segment: '', label: 'Overview', icon: LayoutDashboard, end: true },
  { segment: 'pilots', label: 'Pilots', icon: Users, end: false },
  { segment: 'teams', label: 'Teams', icon: UsersRound, end: false },
  { segment: 'rounds', label: 'Rounds', icon: Target, end: false },
  { segment: 'scoring', label: 'Scoring', icon: Gauge, end: false },
  { segment: 'rankings', label: 'Rankings', icon: Medal, end: false },
  { segment: 'reports', label: 'Reports / Print', icon: FileText, end: false },
  { segment: 'statistics', label: 'Statistics', icon: BarChart3, end: false },
  { segment: 'audit', label: 'Audit', icon: ClipboardList, end: false },
  { segment: 'settings', label: 'Settings', icon: Settings, end: false },
];

function competitionIdFromPath(pathname: string): string | undefined {
  const match = pathname.match(/^\/competitions\/([^/]+)/);
  return match?.[1];
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const competitionId = useMemo(() => competitionIdFromPath(pathname), [pathname]);

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
                {activeCompetition
                  ? `${activeCompetition.code} · Active`
                  : 'Select a competition'}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 scrollbar-thin">
          {globalNav.map(({ to, label, icon: Icon, end }) => (
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

          {competitionId && (
            <>
              <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                Competition
              </p>
              {competitionNav.map(({ segment, label, icon: Icon, end }) => (
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
          <div className="mb-3 flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {user?.firstName} {user?.lastName}
              </p>
              <Badge variant="secondary" className="mt-1 text-[10px]">
                {user?.role.replace(/_/g, ' ')}
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

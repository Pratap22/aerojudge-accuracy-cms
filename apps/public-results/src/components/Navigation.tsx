import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AeroJudgeLogo } from '@aero-judge/ui';
import { CheckCircle2, ClipboardList, Menu, Moon, Pause, Radio, Sun, X } from 'lucide-react';
import { competitionPath } from '../lib/api';
import { useTheme } from '../lib/theme';
import { useCompetition, useRoundsStatus } from '../hooks/useCompetition';
import {
  hasCompetitionStarted,
  isCompetitionCompleted,
  isPreEvent,
  isRegistrationOpen,
} from '../lib/competitionStatus';

export function Navigation() {
  const { competitionId } = useParams<{ competitionId: string }>();
  const id = competitionId ?? '';
  const { data: competition } = useCompetition();
  const { pausedRound } = useRoundsStatus();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const completed = isCompetitionCompleted(competition?.status);
  const started = hasCompetitionStarted(competition?.status);
  const preEvent = isPreEvent(competition?.status);
  const registrationOpen = isRegistrationOpen(competition?.status);

  const navItems = [
    { path: '', label: 'Home' },
    ...(!preEvent ? [{ path: 'results', label: 'Results' }] : []),
    { path: 'pilots', label: 'Pilots' },
    { path: 'event', label: 'Event' },
    ...(registrationOpen ? [{ path: 'register', label: 'Register' }] : []),
  ];

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const statusBadge = completed ? (
    <div className="flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1.5">
      <CheckCircle2 className="h-3 w-3 text-sky-700 dark:text-sky-300" />
      <span className="text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">
        Completed
      </span>
    </div>
  ) : pausedRound ? (
    <div className="flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1.5">
      <Pause className="h-3 w-3 text-amber-800 dark:text-amber-300" />
      <span className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-200">Paused</span>
    </div>
  ) : preEvent ? (
    <div className="flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1.5">
      <ClipboardList className="h-3 w-3 text-amber-800 dark:text-amber-300" />
      <span className="text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
        Registration
      </span>
    </div>
  ) : started ? (
    <motion.div
      animate={{ opacity: [0.6, 1, 0.6] }}
      transition={{ repeat: Infinity, duration: 2 }}
      className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5"
    >
      <Radio className="h-3 w-3 text-emerald-700 dark:text-emerald-400" />
      <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Live</span>
    </motion.div>
  ) : (
    <div className="flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">
        {(competition?.status ?? 'DRAFT').replace(/_/g, ' ')}
      </span>
    </div>
  );

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="inline-flex" aria-label="AeroJudge">
            <AeroJudgeLogo className="h-10 w-auto" />
          </Link>
          <Link
            to={competitionPath(id)}
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            Results
          </Link>
        </div>

        <div className="hidden items-center gap-1 md:flex">
          {navItems.map(({ path, label }) => {
            const href = path ? competitionPath(id, path) : competitionPath(id);
            const active = path
              ? location.pathname === href || location.pathname.startsWith(`${href}/`)
              : location.pathname === href;
            return (
              <Link
                key={path || 'home'}
                to={href}
                aria-current={active ? 'page' : undefined}
                className={
                  active
                    ? 'rounded-lg bg-muted px-3 py-2 text-sm font-medium text-foreground'
                    : 'rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground'
                }
              >
                {label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {statusBadge}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted md:hidden"
            aria-expanded={menuOpen}
            aria-controls="public-nav-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div id="public-nav-menu" className="border-t border-border px-4 py-3 md:hidden">
          <div className="flex flex-col">
            {navItems.map(({ path, label }) => {
              const href = path ? competitionPath(id, path) : competitionPath(id);
              const active = path
                ? location.pathname === href || location.pathname.startsWith(`${href}/`)
                : location.pathname === href;
              return (
                <Link
                  key={path || 'home'}
                  to={href}
                  aria-current={active ? 'page' : undefined}
                  className={
                    active
                      ? 'rounded-lg bg-muted px-3 py-3 text-base font-medium text-foreground'
                      : 'rounded-lg px-3 py-3 text-base font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground'
                  }
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </nav>
  );
}

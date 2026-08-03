import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, ClipboardList, Radio } from 'lucide-react';
import { competitionPath } from '../lib/api';
import { useCompetition } from '../hooks/useCompetition';
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
  const completed = isCompetitionCompleted(competition?.status);
  const started = hasCompetitionStarted(competition?.status);
  const preEvent = isPreEvent(competition?.status);
  const registrationOpen = isRegistrationOpen(competition?.status);

  const navItems = preEvent
    ? [
        { path: '', label: 'Home' },
        { path: 'pilots', label: 'Pilots' },
        { path: 'officials', label: 'Officials' },
        ...(registrationOpen ? [{ path: 'register', label: 'Register' }] : []),
      ]
    : [
        { path: '', label: 'Home' },
        { path: 'results', label: completed ? 'Final Results' : 'Live Results' },
        { path: 'pilots', label: 'Pilots' },
        { path: 'officials', label: 'Officials' },
        { path: 'women', label: 'Women' },
        { path: 'teams', label: 'Team ranking' },
        { path: 'countries', label: 'Countries' },
        { path: 'statistics', label: 'Statistics' },
        ...(registrationOpen ? [{ path: 'register', label: 'Register' }] : []),
      ];

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-[#050d1a]/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="font-display text-2xl font-bold tracking-tight text-white transition-colors hover:text-sky-100"
          >
            AeroJudge
          </Link>
          <Link
            to={competitionPath(id)}
            className="hidden text-sm text-sky-300/70 transition-colors hover:text-sky-200 sm:inline"
          >
            Results
          </Link>
        </div>

        <div className="hidden items-center gap-1 md:flex">
          {navItems.map(({ path, label }) => (
            <Link
              key={path}
              to={path ? competitionPath(id, path) : competitionPath(id)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-sky-100/80 transition-colors hover:bg-white/5 hover:text-white"
            >
              {label}
            </Link>
          ))}
        </div>

        {completed ? (
          <div className="flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1.5">
            <CheckCircle2 className="h-3 w-3 text-sky-300" />
            <span className="text-xs font-semibold uppercase tracking-wider text-sky-300">
              Completed
            </span>
          </div>
        ) : preEvent ? (
          <div className="flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1.5">
            <ClipboardList className="h-3 w-3 text-amber-300" />
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-300">
              Registration
            </span>
          </div>
        ) : started ? (
          <motion.div
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5"
          >
            <Radio className="h-3 w-3 text-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Live
            </span>
          </motion.div>
        ) : (
          <div className="flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-sky-300">
              {(competition?.status ?? 'DRAFT').replace(/_/g, ' ')}
            </span>
          </div>
        )}
      </div>
    </nav>
  );
}

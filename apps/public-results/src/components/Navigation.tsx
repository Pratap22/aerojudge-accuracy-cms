import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Radio } from 'lucide-react';

const NAV_ITEMS = [
  { path: '', label: 'Home' },
  { path: 'results', label: 'Live Results' },
  { path: 'pilots', label: 'Pilots' },
  { path: 'women', label: 'Women' },
  { path: 'teams', label: 'Teams' },
  { path: 'countries', label: 'Countries' },
  { path: 'statistics', label: 'Statistics' },
];

export function Navigation() {
  const { slug } = useParams<{ slug: string }>();

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-[#050d1a]/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to={`/${slug}`} className="group flex items-center gap-3">
          <span className="font-display text-2xl font-bold tracking-tight text-white">NPHA</span>
          <span className="hidden text-sm text-sky-300/70 sm:inline">Accuracy</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map(({ path, label }) => (
            <Link
              key={path}
              to={path ? `/${slug}/${path}` : `/${slug}`}
              className="rounded-lg px-3 py-2 text-sm font-medium text-sky-100/80 transition-colors hover:bg-white/5 hover:text-white"
            >
              {label}
            </Link>
          ))}
        </div>

        <motion.div
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5"
        >
          <Radio className="h-3 w-3 text-emerald-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Live</span>
        </motion.div>
      </div>
    </nav>
  );
}

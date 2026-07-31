import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { Input } from '@npha/ui';
import { competitionPath } from '../lib/api';
import { useResults, useSlug } from '../hooks/useCompetition';
import { countryCodeToEmoji, formatScore, pilotFullName } from '../lib/utils';

export function PilotSearch() {
  const competitionId = useSlug();
  const { data: results } = useResults('OVERALL');
  const [search, setSearch] = useState('');

  const pilots = useMemo(() => {
    if (!results?.rankings) return [];
    const q = search.toLowerCase();
    return results.rankings.filter(
      (r) =>
        !q ||
        pilotFullName(r.pilot.firstName, r.pilot.lastName).toLowerCase().includes(q) ||
        String(r.pilot.pilotNumber).includes(q) ||
        r.pilot.country?.code?.toLowerCase().includes(q),
    );
  }, [results, search]);

  return (
    <div className="space-y-6">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-400/50" />
        <Input
          placeholder="Search by name, number, or country…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border-white/10 bg-white/5 pl-10 text-white placeholder:text-sky-300/40"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pilots.map((row, index) => (
          <motion.div
            key={row.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
          >
            <Link
              to={competitionPath(competitionId, 'pilots', String(row.pilot.pilotNumber))}
              className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-sky-500/30 hover:bg-white/10"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500/20 font-bold text-sky-300">
                {row.pilot.pilotNumber}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-white">
                  {pilotFullName(row.pilot.firstName, row.pilot.lastName)}
                </p>
                <p className="text-sm text-sky-300/60">
                  {countryCodeToEmoji(row.pilot.country?.code ?? '')}{' '}
                  {row.pilot.country?.name ?? row.pilot.nationality ?? '—'}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono font-bold text-white">#{row.rank}</p>
                <p className="text-sm text-sky-400">{formatScore(row.totalScoreCm)} cm</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Search, UserPlus } from 'lucide-react';
import { Input } from '@npha/ui';
import { Layout } from '../components/Layout';
import { competitionPath, fetchPilots } from '../lib/api';
import { useCompetition, useSlug } from '../hooks/useCompetition';
import { countryCodeToEmoji, pilotFullName } from '../lib/utils';
import { isRegistrationOpen } from '../lib/competitionStatus';

export function PilotsPage() {
  const competitionId = useSlug();
  const { data: competition } = useCompetition();
  const registrationOpen = isRegistrationOpen(competition?.status);
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-pilots', competitionId],
    queryFn: () => fetchPilots(competitionId),
    enabled: Boolean(competitionId),
  });

  const pilots = useMemo(() => {
    const list = data?.pilots ?? [];
    const q = search.toLowerCase().trim();
    if (!q) return list;
    return list.filter(
      (p) =>
        pilotFullName(p.firstName, p.lastName).toLowerCase().includes(q) ||
        String(p.pilotNumber).includes(q) ||
        (p.country?.name ?? '').toLowerCase().includes(q) ||
        (p.country?.code ?? '').toLowerCase().includes(q) ||
        (p.club ?? '').toLowerCase().includes(q),
    );
  }, [data?.pilots, search]);

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-bold text-white">Pilots</h1>
            <p className="mt-2 text-sky-300/70">
              {data ? `${data.pilots.length} registered` : 'Registered competitors'}
            </p>
          </div>
          {registrationOpen && (
            <Link
              to={competitionPath(competitionId, 'register')}
              className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-5 py-2.5 text-sm font-semibold text-[#050d1a] hover:bg-sky-400"
            >
              <UserPlus className="h-4 w-4" />
              Register
            </Link>
          )}
        </div>

        <div className="relative mb-8 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-400/50" />
          <Input
            placeholder="Search by name, number, country, or club…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-white/10 bg-white/5 pl-10 text-white placeholder:text-sky-300/40"
          />
        </div>

        {isLoading && <p className="text-sky-400/60">Loading pilots…</p>}
        {error && (
          <p className="text-red-400">
            {error instanceof Error ? error.message : 'Could not load pilots'}
          </p>
        )}
        {!isLoading && !error && pilots.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/15 px-6 py-16 text-center">
            <p className="text-lg text-sky-300/70">No pilots registered yet</p>
            {registrationOpen && (
              <Link
                to={competitionPath(competitionId, 'register')}
                className="mt-4 inline-flex text-sky-400 underline hover:text-sky-300"
              >
                Be the first to register
              </Link>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pilots.map((pilot, index) => (
            <motion.div
              key={pilot.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.02, 0.4) }}
            >
              <Link
                to={competitionPath(competitionId, 'pilots', String(pilot.pilotNumber))}
                className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-sky-500/30 hover:bg-white/10"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500/20 font-bold text-sky-300">
                  {pilot.pilotNumber}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white">
                    {pilotFullName(pilot.firstName, pilot.lastName)}
                  </p>
                  <p className="text-sm text-sky-300/60">
                    {countryCodeToEmoji(pilot.country?.code2 ?? pilot.country?.code ?? '')}{' '}
                    {pilot.country?.name ?? pilot.nationality ?? '—'}
                    {pilot.club ? ` · ${pilot.club}` : ''}
                  </p>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-sky-500/60">
                  {pilot.status.replace(/_/g, ' ')}
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </Layout>
  );
}

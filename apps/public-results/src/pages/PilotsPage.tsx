import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Search, UserPlus } from 'lucide-react';
import { Input } from '@aero-judge/ui';
import { Layout } from '../components/Layout';
import { competitionPath, fetchPilots } from '../lib/api';
import { useCompetition, useSlug } from '../hooks/useCompetition';
import { countryCodeToEmoji, pilotFullName } from '../lib/utils';
import { padPilotNumber } from '@aero-judge/utils';
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
        (p.pilotNumber != null && padPilotNumber(p.pilotNumber).includes(q)) ||
        (p.country?.name ?? '').toLowerCase().includes(q) ||
        (p.country?.code ?? '').toLowerCase().includes(q) ||
        (p.club ?? '').toLowerCase().includes(q),
    );
  }, [data?.pilots, search]);

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="font-display text-xl font-bold text-foreground sm:text-2xl">Pilots</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.pilots.length} registered` : 'Registered competitors'}
          </p>
          {registrationOpen && (
            <Link
              to={competitionPath(competitionId, 'register')}
              className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-3 py-1 text-xs font-semibold text-[#050d1a] hover:bg-sky-400"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Register
            </Link>
          )}
          <div className="relative ml-auto w-full max-w-xs sm:w-64">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search pilots…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 border-border bg-card pl-8 text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {isLoading && <p className="mt-4 text-muted-foreground">Loading pilots…</p>}
        {error && (
          <p className="text-red-400">
            {error instanceof Error ? error.message : 'Could not load pilots'}
          </p>
        )}
        {!isLoading && !error && pilots.length === 0 && (
          <div className="mt-4 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
            <p className="text-lg text-muted-foreground">No pilots registered yet</p>
            {registrationOpen && (
              <Link
                to={competitionPath(competitionId, 'register')}
                className="mt-4 inline-flex text-sky-700 dark:text-sky-400 underline hover:text-sky-800 dark:hover:text-sky-300"
              >
                Be the first to register
              </Link>
            )}
          </div>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {pilots.map((pilot, index) => {
            const flag = countryCodeToEmoji(pilot.country?.code2 ?? '');
            return (
              <motion.div
                key={pilot.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.02, 0.4) }}
              >
                <Link
                  to={competitionPath(competitionId, 'pilots', String(pilot.pilotNumber))}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-card p-3 transition-colors hover:border-sky-500/30 hover:bg-muted"
                >
                  {pilot.photoUrl ? (
                    <img
                      src={pilot.photoUrl}
                      alt=""
                      className="row-span-2 h-14 w-14 shrink-0 rounded-full object-cover object-top ring-1 ring-border"
                    />
                  ) : (
                    <span
                      className="row-span-2 h-14 w-14 shrink-0 rounded-full bg-muted"
                      aria-hidden
                    />
                  )}
                  <p className="min-w-0 truncate font-semibold leading-tight text-foreground">
                    {pilotFullName(pilot.firstName, pilot.lastName)}
                  </p>
                  <p className="flex min-w-0 items-center gap-1.5">
                    <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-primary px-1 font-mono text-xs font-bold tabular-nums text-primary-foreground">
                      {padPilotNumber(pilot.pilotNumber)}
                    </span>
                    {flag ? (
                      <span className="text-base leading-none" aria-hidden>
                        {flag}
                      </span>
                    ) : null}
                    <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {pilot.country?.code || '—'}
                    </span>
                    {pilot.club ? (
                      <span className="truncate text-xs text-muted-foreground">· {pilot.club}</span>
                    ) : null}
                  </p>
                  <span className="col-start-3 row-span-2 row-start-1 self-center text-[10px] uppercase tracking-wider text-muted-foreground">
                    {pilot.status.replace(/_/g, ' ')}
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}

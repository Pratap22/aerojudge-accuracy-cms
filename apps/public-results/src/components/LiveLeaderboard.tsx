import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { Input, LeaderboardTable } from '@npha/ui';
import { useCompetition, useResults, toLeaderboardEntries } from '../hooks/useCompetition';
import { isCompetitionCompleted } from '../lib/competitionStatus';

interface LiveLeaderboardProps {
  title?: string;
  showSearch?: boolean;
  maxRows?: number;
}

export function LiveLeaderboard({ title, showSearch = true, maxRows }: LiveLeaderboardProps) {
  const { data: competition } = useCompetition();
  const { data: results, isLoading, error } = useResults('OVERALL');
  const [search, setSearch] = useState('');
  const completed = isCompetitionCompleted(competition?.status);
  const heading = title ?? (completed ? 'Final Results' : 'Live Leaderboard');

  const entries = useMemo(() => {
    const all = toLeaderboardEntries(results);
    if (!search.trim()) return maxRows ? all.slice(0, maxRows) : all;
    const q = search.toLowerCase();
    const filtered = all.filter(
      (e) =>
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
        String(e.pilotNumber).includes(q) ||
        e.countryCode2?.toLowerCase().includes(q),
    );
    return maxRows ? filtered.slice(0, maxRows) : filtered;
  }, [results, search, maxRows]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-8 text-center text-red-300">
        Unable to load results. Please try again later.
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-3xl font-bold text-white">{heading}</h2>
        {showSearch && (
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-400/50" />
            <Input
              placeholder="Search pilots…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-white/10 bg-white/5 pl-10 text-white placeholder:text-sky-300/40"
            />
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
        <LeaderboardTable
          entries={entries}
          showBullseyes
          showRounds
          highlightPodium
          className="[&_th]:border-white/10 [&_th]:text-sky-300/70 [&_td]:border-white/5 [&_tr]:border-white/5 [&_td]:text-white"
        />
      </div>

      <p className="text-center text-sm text-sky-400/50">
        {completed
          ? 'Competition completed · Official final standings'
          : results?.official
            ? 'Official results · Updated live'
            : 'Provisional results · Updated live'}
      </p>
    </motion.div>
  );
}

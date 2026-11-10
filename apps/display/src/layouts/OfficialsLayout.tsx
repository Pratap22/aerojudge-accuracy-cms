import { motion } from 'framer-motion';
import { UserRound } from 'lucide-react';
import { officialRoleLabel } from '@aero-judge/shared';
import { useOfficials } from '../hooks/useCompetition';
import type { DisplayOfficial } from '../lib/types';

/** Landscape grid that stays inside the venue screen as the list grows. */
function officialGrid(count: number): { cols: number; rows: number } {
  if (count <= 1) return { cols: 1, rows: 1 };
  let cols: number;
  if (count <= 3) cols = count;
  else if (count <= 8) cols = Math.ceil(count / 2);
  else if (count <= 12) cols = Math.ceil(count / 3);
  else if (count <= 20) cols = Math.min(5, Math.ceil(count / 4));
  else cols = Math.min(6, Math.ceil(Math.sqrt(count * 1.6)));
  return { cols, rows: Math.ceil(count / cols) };
}

function OfficialCard({
  official,
  compact,
}: {
  official: DisplayOfficial;
  compact: boolean;
}) {
  const role = officialRoleLabel(official.role);
  const avatarClass = compact
    ? 'h-16 w-16 sm:h-20 sm:w-20'
    : 'h-24 w-24 sm:h-28 sm:w-28 md:h-32 md:w-32';
  const nameClass = compact
    ? 'text-sm sm:text-base'
    : 'text-base sm:text-xl md:text-2xl';
  const roleClass = compact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base';

  return (
    <div className="flex min-h-0 min-w-0 flex-col items-center justify-center gap-2 overflow-hidden px-2 text-center">
      <div
        className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-sky-500/10 ring-2 ring-sky-500/25 ${avatarClass}`}
      >
        {official.imageUrl ? (
          <img
            src={official.imageUrl}
            alt={official.name}
            className="h-full w-full object-cover object-top"
          />
        ) : (
          <UserRound
            className={compact ? 'h-8 w-8 text-sky-400/50' : 'h-12 w-12 text-sky-400/50'}
            strokeWidth={1.25}
          />
        )}
      </div>
      <p
        className={`line-clamp-2 font-display uppercase leading-tight tracking-wide text-white ${nameClass}`}
      >
        {official.name}
      </p>
      <p className={`line-clamp-2 uppercase tracking-[0.15em] text-sky-300/80 ${roleClass}`}>
        {role}
      </p>
    </div>
  );
}

export function OfficialsLayout() {
  const { data: officials = [], isLoading } = useOfficials();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sky-400/60">Loading officials…</p>
      </div>
    );
  }

  if (officials.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-gradient-to-br from-broadcast-navy via-broadcast-navy-mid to-broadcast-navy-light p-16">
        <p className="font-display text-3xl uppercase tracking-[0.3em] text-sky-400/50">
          No officials configured
        </p>
      </div>
    );
  }

  const { cols, rows } = officialGrid(officials.length);
  const compact = rows >= 3 || officials.length > 8;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-gradient-to-br from-broadcast-navy via-broadcast-navy-mid to-broadcast-navy-light px-4 py-3 sm:px-8 sm:py-5">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex min-h-0 flex-1 flex-col"
      >
        <p className="mb-3 shrink-0 text-center text-sm uppercase tracking-[0.4em] text-sky-400/80">
          Officials
        </p>
        <div
          className="grid min-h-0 flex-1"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
            columnGap: '1.25rem',
            rowGap: '0.75rem',
          }}
        >
          {officials.map((official) => (
            <OfficialCard key={official.id} official={official} compact={compact} />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

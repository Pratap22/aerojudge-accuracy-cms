import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { SPONSOR_TYPES } from '@aero-judge/shared';
import { TransparentLogo } from '../components/TransparentLogo';
import { useCompetition, useSponsors } from '../hooks/useCompetition';
import type { Sponsor } from '../lib/types';

const TYPE_ORDER = [...SPONSOR_TYPES];

const TYPE_LABELS: Record<string, string> = {
  TITLE: 'Title',
  PRESENTING: 'Presenting',
  GOLD: 'Gold',
  SILVER: 'Silver',
  BRONZE: 'Bronze',
  STANDARD: 'Standard',
};

/** Landscape grid that stays inside the venue screen as the list grows. */
function sponsorGrid(count: number): { cols: number; rows: number } {
  if (count <= 1) return { cols: 1, rows: 1 };
  let cols: number;
  if (count <= 3) cols = count;
  else if (count <= 8) cols = Math.ceil(count / 2);
  else if (count <= 12) cols = Math.ceil(count / 3);
  else if (count <= 20) cols = Math.min(5, Math.ceil(count / 4));
  else cols = Math.min(6, Math.ceil(Math.sqrt(count * 1.6)));
  return { cols, rows: Math.ceil(count / cols) };
}

function groupSponsorsByType(items: Sponsor[]) {
  const map = new Map<string, Sponsor[]>();
  for (const s of items) {
    const key = (s.type ?? 'STANDARD').toUpperCase();
    const list = map.get(key) ?? [];
    list.push(s);
    map.set(key, list);
  }

  return [...map.entries()]
    .sort(([a], [b]) => {
      const ia = TYPE_ORDER.indexOf(a as (typeof TYPE_ORDER)[number]);
      const ib = TYPE_ORDER.indexOf(b as (typeof TYPE_ORDER)[number]);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    })
    .map(([type, sponsors]) => ({
      type,
      label: TYPE_LABELS[type] ?? type,
      sponsors,
    }));
}

export function SponsorsLayout() {
  const { data: competition } = useCompetition();
  const { data: sponsors = [], isLoading } = useSponsors();
  const partnersLabel = competition?.settings?.partnersLabel?.trim() || 'Sponsors';
  const tiersEnabled = competition?.settings?.partnerTiersEnabled ?? true;

  const groups = useMemo(() => {
    if (!tiersEnabled) {
      return [{ type: 'ALL', label: partnersLabel, sponsors }];
    }
    return groupSponsorsByType(sponsors);
  }, [sponsors, tiersEnabled, partnersLabel]);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (groups.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % groups.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [groups.length]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sky-400/60">Loading {partnersLabel.toLowerCase()}…</p>
      </div>
    );
  }

  if (groups.length === 0 || sponsors.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-gradient-to-br from-broadcast-navy via-broadcast-navy-mid to-broadcast-navy-light p-16">
        <p className="font-display text-3xl uppercase tracking-[0.3em] text-sky-400/50">
          No {partnersLabel.toLowerCase()} configured
        </p>
      </div>
    );
  }

  const current = groups[index % groups.length];
  if (!current) return null;

  const heading = partnersLabel;
  const { cols, rows } = sponsorGrid(current.sponsors.length);
  const nameSize = rows <= 2 ? 'text-4xl' : rows === 3 ? 'text-2xl' : 'text-lg';

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-gradient-to-br from-broadcast-navy via-broadcast-navy-mid to-broadcast-navy-light px-4 py-3 sm:px-8 sm:py-5">
      <AnimatePresence mode="wait">
        <motion.div
          key={current.type}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -24 }}
          transition={{ duration: 0.5 }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <p className="mb-3 shrink-0 text-center text-sm uppercase tracking-[0.4em] text-sky-400/80">
            {heading}
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
            {current.sponsors.map((sponsor) => (
              <div
                key={sponsor.id}
                className="flex min-h-0 min-w-0 items-center justify-center overflow-hidden px-2"
              >
                {sponsor.logoUrl ? (
                  <TransparentLogo
                    src={sponsor.logoUrl}
                    alt={sponsor.name}
                    className="h-full w-full object-contain drop-shadow-[0_0_1px_rgba(255,255,255,0.9)]"
                  />
                ) : (
                  <p
                    className={`line-clamp-3 text-center font-display uppercase leading-tight tracking-wide text-white ${nameSize}`}
                  >
                    {sponsor.name}
                  </p>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
      {groups.length > 1 && (
        <div className="mt-3 flex shrink-0 justify-center gap-2">
          {groups.map((g, i) => (
            <div
              key={g.type}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === index ? 'bg-sky-400' : 'bg-sky-500/30'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

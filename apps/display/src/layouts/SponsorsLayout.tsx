import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { SPONSOR_TYPES } from '@npha/shared';
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

  const heading = tiersEnabled
    ? `${current.label} ${partnersLabel.toLowerCase()}`
    : partnersLabel;

  return (
    <div className="relative flex h-full items-center justify-center bg-gradient-to-br from-broadcast-navy via-broadcast-navy-mid to-broadcast-navy-light p-16">
      <AnimatePresence mode="wait">
        <motion.div
          key={current.type}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -24 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-6xl text-center"
        >
          <p className="mb-10 text-sm uppercase tracking-[0.4em] text-sky-400/80">{heading}</p>
          <div className="flex flex-wrap items-center justify-center gap-10">
            {current.sponsors.map((sponsor) => (
              <div key={sponsor.id} className="flex flex-col items-center gap-3">
                <div className="flex h-36 w-64 items-center justify-center rounded-2xl border-2 border-sky-500/40 bg-white/95 px-6">
                  {sponsor.logoUrl ? (
                    <img
                      src={sponsor.logoUrl}
                      alt={sponsor.name}
                      className="max-h-28 max-w-full object-contain"
                    />
                  ) : (
                    <span className="font-display text-3xl tracking-wider text-broadcast-navy">
                      {sponsor.name}
                    </span>
                  )}
                </div>
                {!sponsor.logoUrl && (
                  <p className="font-display text-2xl uppercase tracking-wide text-white">
                    {sponsor.name}
                  </p>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
      {groups.length > 1 && (
        <div className="absolute bottom-12 flex gap-2">
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

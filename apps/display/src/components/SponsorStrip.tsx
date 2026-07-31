import { useMemo } from 'react';
import { SPONSOR_TYPES } from '@npha/shared';
import { useCompetition, useSponsors } from '../hooks/useCompetition';
import type { Sponsor } from '../lib/types';

interface SponsorStripProps {
  sponsors?: Sponsor[];
  variant?: 'strip' | 'full';
}

/** Fixed strip height so parent layouts (podium, top10, etc.) stay stable. */
const STRIP_HEIGHT = 'h-14';

const TYPE_ORDER = [...SPONSOR_TYPES];

const TYPE_LABELS: Record<string, string> = {
  TITLE: 'Title',
  PRESENTING: 'Presenting',
  GOLD: 'Gold',
  SILVER: 'Silver',
  BRONZE: 'Bronze',
  STANDARD: 'Standard',
};

function typeRank(type: string | undefined | null): number {
  const key = (type ?? 'STANDARD').toUpperCase();
  const idx = TYPE_ORDER.indexOf(key as (typeof TYPE_ORDER)[number]);
  return idx === -1 ? TYPE_ORDER.length : idx;
}

function groupSponsorsByType(items: Sponsor[]): { type: string; label: string; sponsors: Sponsor[] }[] {
  const map = new Map<string, Sponsor[]>();
  for (const s of items) {
    const key = (s.type ?? 'STANDARD').toUpperCase();
    const list = map.get(key) ?? [];
    list.push(s);
    map.set(key, list);
  }

  return [...map.entries()]
    .sort(([a], [b]) => typeRank(a) - typeRank(b))
    .map(([type, sponsors]) => ({
      type,
      label: TYPE_LABELS[type] ?? type,
      sponsors,
    }));
}

function SponsorMark({ sponsor }: { sponsor: Sponsor }) {
  if (sponsor.logoUrl) {
    return (
      <div className="flex h-9 w-28 shrink-0 items-center justify-center overflow-hidden rounded bg-white/95 px-2">
        <img
          src={sponsor.logoUrl}
          alt={sponsor.name}
          className="max-h-7 max-w-full object-contain"
        />
      </div>
    );
  }

  return (
    <span className="shrink-0 font-display text-base tracking-wider text-white/90">
      {sponsor.name}
    </span>
  );
}

function SponsorTypeGroup({
  group,
  showTypeLabel,
}: {
  group: { type: string; label: string; sponsors: Sponsor[] };
  showTypeLabel: boolean;
}) {
  return (
    <div className="mx-5 flex h-full shrink-0 items-center gap-4 border-r border-sky-500/20 pr-6 last:border-r-0">
      {showTypeLabel && (
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.28em] text-sky-400">
          {group.label}
        </span>
      )}
      <div className="flex h-full items-center gap-4">
        {group.sponsors.map((sponsor) => (
          <SponsorMark key={sponsor.id} sponsor={sponsor} />
        ))}
      </div>
    </div>
  );
}

export function SponsorStrip({ sponsors, variant = 'strip' }: SponsorStripProps) {
  const { data: competition } = useCompetition();
  const { data: fetched = [] } = useSponsors();
  const items = (sponsors?.length ? sponsors : fetched).filter(Boolean);
  const partnersLabel = competition?.settings?.partnersLabel?.trim() || 'Sponsors';
  const tiersEnabled = competition?.settings?.partnerTiersEnabled ?? true;

  const groups = useMemo(() => {
    if (!tiersEnabled) {
      return [{ type: 'ALL', label: partnersLabel, sponsors: items }];
    }
    return groupSponsorsByType(items);
  }, [items, tiersEnabled, partnersLabel]);

  if (items.length === 0) return null;

  if (variant === 'full') {
    return (
      <div className="flex flex-col items-center gap-10">
        {groups.map((group) => (
          <div key={group.type} className="w-full max-w-5xl">
            <p className="mb-4 text-center text-sm uppercase tracking-[0.35em] text-sky-400/80">
              {tiersEnabled ? `${group.label} ${partnersLabel.toLowerCase()}` : partnersLabel}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-8">
              {group.sponsors.map((sponsor) => (
                <div key={sponsor.id} className="flex flex-col items-center gap-2">
                  <div className="flex h-28 w-56 items-center justify-center overflow-hidden rounded-lg border border-sky-500/30 bg-white/95 px-4">
                    {sponsor.logoUrl ? (
                      <img
                        src={sponsor.logoUrl}
                        alt={sponsor.name}
                        className="max-h-20 max-w-full object-contain"
                      />
                    ) : (
                      <span className="font-display text-2xl tracking-wider text-broadcast-navy">
                        {sponsor.name}
                      </span>
                    )}
                  </div>
                  {!sponsor.logoUrl && (
                    <span className="text-sm text-white/80">{sponsor.name}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const loop = groups.length <= 1 ? groups : [...groups, ...groups];
  const durationSec = Math.max(22, groups.length * 10);

  return (
    <div
      className={`flex ${STRIP_HEIGHT} w-full shrink-0 items-center gap-4 overflow-hidden border-t border-sky-500/20 bg-broadcast-navy-mid/95 px-5`}
    >
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.3em] text-sky-400">
        {partnersLabel}
      </span>
      <div className="relative h-full min-w-0 flex-1 overflow-hidden">
        <div
          className="sponsor-marquee flex h-full w-max items-center"
          style={{ animationDuration: `${durationSec}s` }}
        >
          {loop.map((group, i) => (
            <SponsorTypeGroup
              key={`${group.type}-${i}`}
              group={group}
              showTypeLabel={tiersEnabled}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

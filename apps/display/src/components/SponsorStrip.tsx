import { useSponsors } from '../hooks/useCompetition';
import type { Sponsor } from '../lib/types';

interface SponsorStripProps {
  sponsors?: Sponsor[];
  variant?: 'strip' | 'full';
}

function SponsorMark({ sponsor }: { sponsor: Sponsor }) {
  return (
    <div className="flex shrink-0 items-center gap-3 px-6">
      {sponsor.logoUrl ? (
        <img
          src={sponsor.logoUrl}
          alt={sponsor.name}
          className="h-10 max-w-[140px] object-contain"
        />
      ) : (
        <span className="font-display text-lg tracking-wider text-white/85">{sponsor.name}</span>
      )}
      {sponsor.type && (
        <span className="text-[10px] uppercase tracking-[0.2em] text-sky-400/60">{sponsor.type}</span>
      )}
    </div>
  );
}

export function SponsorStrip({ sponsors, variant = 'strip' }: SponsorStripProps) {
  const { data: fetched = [] } = useSponsors();
  const items = (sponsors?.length ? sponsors : fetched).filter(Boolean);

  if (items.length === 0) return null;

  if (variant === 'full') {
    return (
      <div className="flex flex-wrap items-center justify-center gap-10">
        {items.map((sponsor) => (
          <div key={sponsor.id} className="flex flex-col items-center gap-2">
            <div className="flex h-24 w-48 items-center justify-center rounded-lg border border-sky-500/30 bg-broadcast-navy-light/80 px-4">
              {sponsor.logoUrl ? (
                <img
                  src={sponsor.logoUrl}
                  alt={sponsor.name}
                  className="max-h-16 max-w-full object-contain"
                />
              ) : (
                <span className="font-display text-2xl tracking-wider text-white">{sponsor.name}</span>
              )}
            </div>
            <span className="text-xs uppercase tracking-[0.25em] text-sky-300/70">
              {sponsor.type ?? sponsor.tagline ?? sponsor.name}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // Duplicate list for seamless infinite scroll
  const loop = items.length === 1 ? items : [...items, ...items];
  const durationSec = Math.max(18, items.length * 6);

  return (
    <div className="flex items-center gap-6 overflow-hidden border-t border-sky-500/20 bg-broadcast-navy-mid/90 px-6 py-3">
      <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.3em] text-sky-400">
        Sponsors
      </span>
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <div
          className="sponsor-marquee flex w-max items-center"
          style={{ animationDuration: `${durationSec}s` }}
        >
          {loop.map((sponsor, i) => (
            <SponsorMark key={`${sponsor.id}-${i}`} sponsor={sponsor} />
          ))}
        </div>
      </div>
    </div>
  );
}

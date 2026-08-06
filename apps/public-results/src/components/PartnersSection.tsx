import { motion } from 'framer-motion';
import { Building2, ExternalLink } from 'lucide-react';
import { SPONSOR_TYPES, type SponsorType } from '@npha/shared';
import type { PublicSponsor } from '../lib/api';

const TYPE_LABELS: Record<string, string> = {
  TITLE: 'Title',
  PRESENTING: 'Presenting',
  GOLD: 'Gold',
  SILVER: 'Silver',
  BRONZE: 'Bronze',
  STANDARD: 'Standard',
};

const TYPE_ORDER = [...SPONSOR_TYPES];

function typeRank(type: string | null | undefined): number {
  const key = (type ?? 'STANDARD').toUpperCase();
  const idx = TYPE_ORDER.indexOf(key as SponsorType);
  return idx === -1 ? TYPE_ORDER.length : idx;
}

function groupByType(items: PublicSponsor[]): { type: string; label: string; items: PublicSponsor[] }[] {
  const map = new Map<string, PublicSponsor[]>();
  for (const s of items) {
    const key = (s.type ?? 'STANDARD').toUpperCase();
    const list = map.get(key) ?? [];
    list.push(s);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort((a, b) => typeRank(a[0]) - typeRank(b[0]))
    .map(([type, list]) => ({
      type,
      label: TYPE_LABELS[type] ?? type,
      items: list,
    }));
}

function PartnerCard({
  partner,
  index = 0,
  showType = true,
}: {
  partner: PublicSponsor;
  index?: number;
  showType?: boolean;
}) {
  const logo = (
    <div className="mx-auto flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#0a1628] ring-2 ring-sky-500/20 sm:h-32 sm:w-32">
      {partner.logoUrl ? (
        <img
          src={partner.logoUrl}
          alt={partner.name}
          className="h-[85%] w-[85%] object-contain p-2"
        />
      ) : (
        <Building2 className="h-12 w-12 text-sky-400/35" strokeWidth={1.25} />
      )}
    </div>
  );

  const body = (
    <>
      {logo}
      <h3 className="mt-5 text-base font-semibold leading-snug text-sky-300 sm:text-lg">
        {partner.name}
      </h3>
      {showType && partner.type ? (
        <p className="mt-1.5 text-sm text-sky-100/50">
          {TYPE_LABELS[partner.type] ?? partner.type}
        </p>
      ) : null}
      {partner.websiteUrl ? (
        <span className="mt-3 inline-flex items-center gap-1 text-xs text-sky-400/70">
          <ExternalLink className="h-3 w-3" />
          Visit
        </span>
      ) : null}
    </>
  );

  const className =
    'flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-8 text-center backdrop-blur-sm transition-colors hover:border-sky-500/25 hover:bg-white/[0.07]';

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.35) }}
      className={className}
    >
      {partner.websiteUrl ? (
        <a
          href={partner.websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full flex-col items-center"
        >
          {body}
        </a>
      ) : (
        body
      )}
    </motion.article>
  );
}

interface PartnersSectionProps {
  partners: PublicSponsor[];
  /** From competition settings — "Sponsors" or "Supporters" */
  label?: string;
  tiersEnabled?: boolean;
  isLoading?: boolean;
  error?: Error | null;
}

export function PartnersSection({
  partners,
  label = 'Sponsors',
  tiersEnabled = true,
  isLoading,
  error,
}: PartnersSectionProps) {
  if (isLoading) {
    return (
      <section className="mx-auto max-w-7xl px-6 py-12">
        <p className="text-sky-400/60">Loading {label.toLowerCase()}…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mx-auto max-w-7xl px-6 py-12">
        <p className="text-red-400">{error.message || `Could not load ${label.toLowerCase()}`}</p>
      </section>
    );
  }

  if (partners.length === 0) return null;

  const groups = tiersEnabled ? groupByType(partners) : [{ type: 'ALL', label: '', items: partners }];

  return (
    <section className="mx-auto max-w-7xl px-6 py-12 md:py-16">
      <div className="mb-8 flex items-baseline justify-between gap-4 border-b border-white/15 pb-3">
        <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">{label}</h2>
      </div>

      <div className="space-y-10">
        {groups.map((group) => (
          <div key={group.type} className="space-y-4">
            {tiersEnabled && group.label ? (
              <h3 className="text-sm font-semibold uppercase tracking-wider text-sky-300/60">
                {group.label}
              </h3>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {group.items.map((partner, index) => (
                <PartnerCard
                  key={partner.id}
                  partner={partner}
                  index={index}
                  showType={tiersEnabled}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

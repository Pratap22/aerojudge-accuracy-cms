import { motion } from 'framer-motion';
import { Building2, ExternalLink } from 'lucide-react';
import { SPONSOR_TYPES, type SponsorType } from '@aero-judge/shared';
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

/** Standard is the default tier and is not printed on each partner. */
function visibleTierLabel(type: string | null | undefined): string | null {
  if (!type) return null;
  const key = type.toUpperCase();
  if (key === 'STANDARD') return null;
  return TYPE_LABELS[key] ?? type;
}

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
    <div className="mx-auto flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted ring-2 ring-sky-500/20">
      {partner.logoUrl ? (
        <img
          src={partner.logoUrl}
          alt={partner.name}
          className="h-[85%] w-[85%] object-contain p-2"
        />
      ) : (
        <Building2 className="h-7 w-7 text-muted-foreground/50" strokeWidth={1.25} />
      )}
    </div>
  );

  const body = (
    <>
      {logo}
      <h3 className="mt-3 text-sm font-semibold leading-snug text-sky-700 dark:text-sky-300">
        {partner.name}
      </h3>
      {showType && visibleTierLabel(partner.type) ? (
        <p className="mt-1.5 text-sm text-muted-foreground">{visibleTierLabel(partner.type)}</p>
      ) : null}
      {partner.websiteUrl ? (
        <span className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <ExternalLink className="h-3 w-3" />
          Visit
        </span>
      ) : null}
    </>
  );

  const className =
    'flex flex-col items-center rounded-xl border border-border bg-card px-3 py-4 text-center transition-colors hover:border-sky-500/25 hover:bg-muted';

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
        <p className="text-muted-foreground">Loading {label.toLowerCase()}…</p>
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
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-border pb-2">
        <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{label}</h2>
      </div>

      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.type} className="space-y-4">
            {tiersEnabled && visibleTierLabel(group.type) ? (
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {visibleTierLabel(group.type)}
              </h3>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

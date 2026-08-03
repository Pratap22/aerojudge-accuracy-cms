import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Phone, UserRound } from 'lucide-react';
import type { PublicOfficial } from '../lib/api';
import { competitionPath } from '../lib/api';

function Avatar({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  return (
    <div className="mx-auto flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#0a1628] ring-2 ring-sky-500/20 sm:h-32 sm:w-32">
      {imageUrl ? (
        <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        <UserRound className="h-12 w-12 text-sky-400/35" strokeWidth={1.25} />
      )}
    </div>
  );
}

interface OfficialCardProps {
  official: PublicOfficial;
  showContact?: boolean;
  index?: number;
}

export function OfficialCard({ official, showContact = false, index = 0 }: OfficialCardProps) {
  const hasContact = showContact && (official.email || official.phone);

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.35) }}
      className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-8 text-center backdrop-blur-sm transition-colors hover:border-sky-500/25 hover:bg-white/[0.07]"
    >
      <Avatar name={official.name} imageUrl={official.imageUrl} />
      <h3 className="mt-5 text-base font-semibold leading-snug text-sky-300 sm:text-lg">
        {official.name}
      </h3>
      <p className="mt-1.5 text-sm text-sky-100/50">{official.role}</p>
      {hasContact && (
        <div className="mt-4 w-full space-y-2.5 border-t border-white/10 pt-4 text-sm text-sky-100/65">
          {official.email && (
            <a
              href={`mailto:${official.email}`}
              className="flex items-center justify-center gap-2 transition-colors hover:text-sky-300"
            >
              <Mail className="h-3.5 w-3.5 shrink-0 text-sky-400/50" />
              <span className="truncate">{official.email}</span>
            </a>
          )}
          {official.phone && (
            <a
              href={`tel:${official.phone}`}
              className="flex items-center justify-center gap-2 transition-colors hover:text-sky-300"
            >
              <Phone className="h-3.5 w-3.5 shrink-0 text-sky-400/50" />
              <span>{official.phone}</span>
            </a>
          )}
        </div>
      )}
    </motion.article>
  );
}

interface OrganizingTeamSectionProps {
  competitionId: string;
  officials: PublicOfficial[];
  /** Max cards on home preview; omit for full list */
  limit?: number;
  showContact?: boolean;
  isLoading?: boolean;
  error?: Error | null;
  /** When false, hide the top bar (full page provides its own heading) */
  showHeader?: boolean;
}

export function OrganizingTeamSection({
  competitionId,
  officials,
  limit,
  showContact = false,
  isLoading,
  error,
  showHeader = true,
}: OrganizingTeamSectionProps) {
  if (isLoading) {
    return (
      <section className="mx-auto max-w-7xl px-6 py-12">
        <p className="text-sky-400/60">Loading organizing team…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mx-auto max-w-7xl px-6 py-12">
        <p className="text-red-400">{error.message || 'Could not load team'}</p>
      </section>
    );
  }

  if (officials.length === 0) {
    if (!showHeader) {
      return (
        <div className="rounded-2xl border border-dashed border-white/15 px-6 py-16 text-center">
          <p className="text-lg text-sky-300/70">No organizing team listed yet</p>
        </div>
      );
    }
    return null;
  }

  const items = limit != null ? officials.slice(0, limit) : officials;

  return (
    <section className="mx-auto max-w-7xl px-6 py-12 md:py-16">
      {showHeader && (
        <div className="mb-8 flex items-baseline justify-between gap-4 border-b border-white/15 pb-3">
          <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
            Organizing Team
          </h2>
          {limit != null && (
            <Link
              to={competitionPath(competitionId, 'officials')}
              className="shrink-0 text-sm font-medium text-sky-400 underline-offset-4 hover:text-sky-300 hover:underline"
            >
              Show all
            </Link>
          )}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((official, index) => (
          <OfficialCard
            key={official.id}
            official={official}
            showContact={showContact}
            index={index}
          />
        ))}
      </div>
    </section>
  );
}

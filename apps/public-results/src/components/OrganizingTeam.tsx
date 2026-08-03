import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, Mail, Phone, UserRound } from 'lucide-react';
import type { PublicOfficial } from '../lib/api';
import { competitionPath } from '../lib/api';
import type { PublicOrganiser } from '../lib/types';

function Avatar({
  name,
  imageUrl,
  isLogo = false,
}: {
  name: string;
  imageUrl: string | null;
  /** Organization logos use contain-fit instead of crop. */
  isLogo?: boolean;
}) {
  return (
    <div className="mx-auto flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#0a1628] ring-2 ring-sky-500/20 sm:h-32 sm:w-32">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name}
          className={
            isLogo
              ? 'h-[85%] w-[85%] object-contain p-1'
              : 'h-full w-full object-cover object-top'
          }
        />
      ) : isLogo ? (
        <Building2 className="h-12 w-12 text-sky-400/35" strokeWidth={1.25} />
      ) : (
        <UserRound className="h-12 w-12 text-sky-400/35" strokeWidth={1.25} />
      )}
    </div>
  );
}

interface PersonCardProps {
  name: string;
  role: string;
  imageUrl: string | null;
  isLogo?: boolean;
  email?: string | null;
  phone?: string | null;
  showContact?: boolean;
  index?: number;
}

function PersonCard({
  name,
  role,
  imageUrl,
  isLogo = false,
  email,
  phone,
  showContact = false,
  index = 0,
}: PersonCardProps) {
  const hasContact = showContact && (email || phone);

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.35) }}
      className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-8 text-center backdrop-blur-sm transition-colors hover:border-sky-500/25 hover:bg-white/[0.07]"
    >
      <Avatar name={name} imageUrl={imageUrl} isLogo={isLogo} />
      <h3 className="mt-5 text-base font-semibold leading-snug text-sky-300 sm:text-lg">
        {name}
      </h3>
      <p className="mt-1.5 text-sm text-sky-100/50">{role}</p>
      {hasContact && (
        <div className="mt-4 w-full space-y-2.5 border-t border-white/10 pt-4 text-sm text-sky-100/65">
          {email && (
            <a
              href={`mailto:${email}`}
              className="flex items-center justify-center gap-2 transition-colors hover:text-sky-300"
            >
              <Mail className="h-3.5 w-3.5 shrink-0 text-sky-400/50" />
              <span className="truncate">{email}</span>
            </a>
          )}
          {phone && (
            <a
              href={`tel:${phone}`}
              className="flex items-center justify-center gap-2 transition-colors hover:text-sky-300"
            >
              <Phone className="h-3.5 w-3.5 shrink-0 text-sky-400/50" />
              <span>{phone}</span>
            </a>
          )}
        </div>
      )}
    </motion.article>
  );
}

interface OfficialCardProps {
  official: PublicOfficial;
  showContact?: boolean;
  index?: number;
}

export function OfficialCard({ official, showContact = false, index = 0 }: OfficialCardProps) {
  return (
    <PersonCard
      name={official.name}
      role={official.role}
      imageUrl={official.imageUrl}
      email={official.email}
      phone={official.phone}
      showContact={showContact}
      index={index}
    />
  );
}

interface OrganizerCardProps {
  organiser: PublicOrganiser;
  index?: number;
}

export function OrganizerCard({ organiser, index = 0 }: OrganizerCardProps) {
  return (
    <PersonCard
      name={organiser.name}
      role={organiser.role}
      imageUrl={organiser.logoUrl}
      isLogo
      index={index}
    />
  );
}

interface OrganizingTeamSectionProps {
  competitionId: string;
  officials: PublicOfficial[];
  organiser?: PublicOrganiser | null;
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
  organiser,
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

  const hasOrganiser = Boolean(organiser?.name);
  if (officials.length === 0 && !hasOrganiser) {
    if (!showHeader) {
      return (
        <div className="rounded-2xl border border-dashed border-white/15 px-6 py-16 text-center">
          <p className="text-lg text-sky-300/70">No organizing team listed yet</p>
        </div>
      );
    }
    return null;
  }

  // Home: show organiser first, then officials up to limit total cards
  const officialSlots =
    limit != null
      ? Math.max(0, limit - (hasOrganiser ? 1 : 0))
      : officials.length;
  const officialItems =
    limit != null ? officials.slice(0, officialSlots) : officials;

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
        {hasOrganiser && organiser ? (
          <OrganizerCard organiser={organiser} index={0} />
        ) : null}
        {officialItems.map((official, index) => (
          <OfficialCard
            key={official.id}
            official={official}
            showContact={showContact}
            index={index + (hasOrganiser ? 1 : 0)}
          />
        ))}
      </div>
    </section>
  );
}

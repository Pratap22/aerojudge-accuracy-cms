import { motion } from 'framer-motion';
import { CountryFlag } from '../components/CountryFlag';
import { SponsorStrip } from '../components/SponsorStrip';
import type { PublicRankingRow } from '../lib/types';
import { pilotFullName } from '../lib/utils';

interface NextPilotsLayoutProps {
  current: PublicRankingRow | null;
  queue: PublicRankingRow[];
}

function PilotCard({
  pilot,
  label,
  variant,
}: {
  pilot: PublicRankingRow | null;
  label: string;
  variant: 'current' | 'next' | 'upcoming';
}) {
  const borderColor =
    variant === 'current'
      ? 'border-sky-400'
      : variant === 'next'
        ? 'border-broadcast-amber'
        : 'border-sky-500/30';

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={`flex flex-1 flex-col items-center justify-center rounded-2xl border-2 ${borderColor} bg-broadcast-navy-light/60 p-8`}
    >
      <p className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-sky-400">{label}</p>
      {pilot?.pilot ? (
        <>
          <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-sky-500 font-display text-5xl text-broadcast-navy">
            {pilot.pilot.pilotNumber}
          </div>
          <CountryFlag code={pilot.pilot.country?.code ?? 'XX'} size="md" className="mb-3" />
          <h3 className="text-center font-display text-3xl uppercase text-white">
            {pilotFullName(pilot.pilot.firstName, pilot.pilot.lastName)}
          </h3>
          <p className="mt-2 text-sky-300">Rank #{pilot.rank}</p>
        </>
      ) : (
        <p className="text-xl text-sky-400/50">—</p>
      )}
    </motion.div>
  );
}

export function NextPilotsLayout({ current, queue }: NextPilotsLayoutProps) {
  const [next, ...upcoming] = queue;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col p-10">
        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-8 font-display text-5xl uppercase tracking-[0.15em] text-sky-400"
        >
          On Deck
        </motion.h2>
        <div className="flex flex-1 gap-6">
          <PilotCard pilot={current} label="Now Flying" variant="current" />
          <PilotCard pilot={next ?? null} label="On Deck" variant="next" />
          <PilotCard pilot={upcoming[0] ?? null} label="Next Up" variant="upcoming" />
        </div>
        {upcoming.length > 1 && (
          <div className="mt-6 flex flex-wrap gap-3">
            {upcoming.slice(1, 6).map((p) => {
              if (!p.pilot) return null;
              return (
                <span
                  key={p.id}
                  className="rounded-full border border-sky-500/30 bg-broadcast-navy-mid px-4 py-2 text-sm text-sky-300"
                >
                  #{p.pilot.pilotNumber} {p.pilot.firstName} {p.pilot.lastName.charAt(0)}.
                </span>
              );
            })}
          </div>
        )}
      </div>
      <SponsorStrip />
    </div>
  );
}

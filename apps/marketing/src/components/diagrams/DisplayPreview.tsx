import { useEffect, useState } from 'react';
import { Monitor, Projector, Tv, Wallpaper } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  fetchLatestPublicScore,
  fetchOverallBoard,
  fetchPublicCompetitions,
} from '@/lib/api';
import { buildDisplaySnapshot, featuredCompetitionCandidates, type DisplaySnapshot } from '@/lib/hero-board';
import { inView, motionSafe, staggerContainer, staggerItem } from '@/lib/motion';

const surfaces = [
  { icon: Wallpaper, label: 'LED Wall' },
  { icon: Tv, label: 'TV' },
  { icon: Projector, label: 'Projector' },
  { icon: Monitor, label: 'External Monitor' },
];

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-400/90">{label}</p>
      <p className={`font-display text-2xl leading-none sm:text-3xl ${accent ? 'text-amber-400' : 'text-white'}`}>
        {value}
      </p>
    </div>
  );
}

export function DisplayPreview() {
  const reduce = useReducedMotion();
  const grid = motionSafe(reduce, staggerContainer(0.08));
  const [board, setBoard] = useState<DisplaySnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const list = await fetchPublicCompetitions();
        for (const competition of featuredCompetitionCandidates(list).slice(0, 4)) {
          const slug = competition.publicSlug || competition.id;
          const [overall, latest] = await Promise.all([
            fetchOverallBoard(slug).catch(() => null),
            fetchLatestPublicScore(slug).catch(() => null),
          ]);
          if (!overall) continue;
          const snapshot = buildDisplaySnapshot({
            competition,
            rankings: overall.rankings,
            teams: [],
            latest,
          });
          if (!snapshot) continue;
          if (!cancelled) setBoard(snapshot);
          return;
        }
      } catch {
        // Keep the display frame without inventing a pilot.
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const scoreClass = board?.bullseye
    ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-400'
    : 'border-sky-500/30 bg-[#0f2744]/80 text-white';

  return (
    <div className="mt-6 grid items-center gap-6 lg:grid-cols-[1.35fr_0.65fr]">
      <div
        className="overflow-hidden rounded-xl border border-sky-500/20 bg-[#050d1a] text-white shadow-xl"
        aria-label={board ? `${board.competitionName} venue display` : 'Venue display'}
      >
        <div className="grid gap-3 p-3 sm:grid-cols-12 sm:gap-4 sm:p-4">
          <div className="relative aspect-[4/5] overflow-hidden rounded-lg border border-sky-500/20 bg-[#0a1628] sm:col-span-5 sm:aspect-auto sm:min-h-[280px]">
            {board?.photoUrl ? (
              <img src={board.photoUrl} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#0f2744] to-[#050d1a]">
                <span className="font-display text-5xl text-sky-400">{board ? `#${board.pilotNumber}` : '—'}</span>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-3 pb-3 pt-12">
              <div className="rounded-lg bg-black/65 px-2.5 py-1.5 backdrop-blur-sm">
                <p className="font-display text-2xl leading-none text-white">
                  {board ? `#${board.pilotNumber}` : '—'}
                </p>
              </div>
              {board?.flag ? (
                <span className="rounded-lg bg-black/65 px-2 py-1 text-3xl leading-none backdrop-blur-sm" aria-hidden>
                  {board.flag}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex min-w-0 flex-col justify-center gap-3 sm:col-span-7">
            <p className="truncate text-[11px] font-medium uppercase tracking-[0.22em] text-sky-400/80">
              {board?.competitionName ?? 'Live competition'}
            </p>
            <p className="font-display text-3xl uppercase leading-[1.05] tracking-wide text-white sm:text-4xl">
              {board?.pilotName ?? 'Awaiting pilot'}
            </p>
            {board?.country ? <p className="text-sm font-medium text-sky-300">{board.country}</p> : null}

            <div className="grid grid-cols-3 gap-3">
              <Stat label="Round" value={board?.roundLabel ?? '—'} />
              <Stat label="Rank" value={board?.rankLabel ?? '—'} accent />
              <Stat label="Total" value={board ? `${board.totalLabel} cm` : '—'} />
            </div>

            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-400/90">
                Last score
              </p>
              <div className={`flex flex-col items-center justify-center rounded-lg border px-4 py-3 ${scoreClass}`}>
                <p className="font-mono text-4xl font-bold leading-none tracking-tighter sm:text-5xl">
                  {board?.scoreLabel ?? '—'}
                  <span className="ml-2 text-lg font-semibold text-sky-300">cm</span>
                </p>
                {board?.bullseye ? (
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-400">
                    Bullseye
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <motion.ul className="grid grid-cols-2 gap-3" {...grid} viewport={inView}>
        {surfaces.map(({ icon: Icon, label }) => (
          <motion.li
            key={label}
            variants={reduce ? undefined : staggerItem}
            whileHover={reduce ? undefined : { y: -3 }}
            className="flex flex-col items-center gap-2 rounded-lg border border-border bg-white px-3 py-5 text-center shadow-sm"
          >
            <Icon className="h-6 w-6 text-sky" aria-hidden />
            <span className="text-sm font-medium text-navy">{label}</span>
          </motion.li>
        ))}
      </motion.ul>
    </div>
  );
}

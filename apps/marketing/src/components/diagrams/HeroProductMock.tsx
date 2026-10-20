import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  competitionResultsHref,
  fetchLatestPublicScore,
  fetchOverallBoard,
  fetchPublicCompetitions,
  fetchTeamBoard,
} from '@/lib/api';
import { buildHeroBoard, featuredCompetitionCandidates, type HeroBoard } from '@/lib/hero-board';

type LoadedBoard = {
  board: HeroBoard;
  href: string;
};

export function HeroProductMock() {
  const reduce = useReducedMotion();
  const [loaded, setLoaded] = useState<LoadedBoard | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const list = await fetchPublicCompetitions();
        for (const competition of featuredCompetitionCandidates(list).slice(0, 4)) {
          const slug = competition.publicSlug || competition.id;
          const [overall, teams, latest] = await Promise.all([
            fetchOverallBoard(slug).catch(() => null),
            fetchTeamBoard(slug).catch(() => ({ rankings: [] })),
            fetchLatestPublicScore(slug).catch(() => null),
          ]);
          if (!overall) continue;
          const board = buildHeroBoard({
            competition,
            rankings: overall.rankings,
            teams: teams.rankings.map((row) => ({
              rank: row.rank,
              name: row.team?.name ?? '',
              pilotNumbers: (row.pilots ?? []).map((pilot) => pilot.pilotNumber),
            })),
            latest,
          });
          if (!board) continue;
          if (!cancelled) {
            setLoaded({ board, href: competitionResultsHref(competition) });
          }
          return;
        }
      } catch {
        // Leave the card empty rather than invent a leaderboard.
      } finally {
        if (!cancelled) setSettled(true);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (settled && !loaded) return null;

  const board = loaded?.board;

  return (
    <div className="relative mx-auto w-full max-w-lg overflow-x-clip lg:max-w-none">
      <motion.div
        className="absolute -inset-4 rounded-2xl bg-target-ring"
        style={{ opacity: 0.8 }}
        animate={
          reduce
            ? undefined
            : {
                scale: [1, 1.04, 1],
                opacity: [0.55, 0.85, 0.55],
              }
        }
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden
      />
      <a
        href={loaded?.href ?? undefined}
        className={`relative block overflow-hidden rounded-xl border border-navy/10 bg-white shadow-[0_24px_60px_-24px_rgba(0,36,71,0.45)] ${
          loaded ? 'transition-transform hover:-translate-y-0.5' : 'pointer-events-none'
        }`}
        aria-label={board ? `${board.competitionName} results` : 'Loading competition results'}
      >
        <div className="flex items-center gap-2 border-b border-border bg-navy px-4 py-3">
          <motion.span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-sky"
            animate={reduce ? undefined : { opacity: [1, 0.25, 1], scale: [1, 0.85, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <span className="truncate text-xs font-medium tracking-wide text-white/80">
            {board?.title ?? 'Loading results'}
          </span>
        </div>

        <div className="grid min-w-0 gap-0 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="min-w-0 border-b border-border p-4 sm:border-b-0 sm:border-r">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Current landing
            </p>
            <div className="mt-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-display text-2xl font-bold text-navy">
                  {board?.pilotLabel ?? '—'}
                </p>
                <p className="mt-1 truncate text-sm text-muted-foreground">{board?.detail ?? '—'}</p>
              </div>
              <motion.div
                className="shrink-0 rounded-lg bg-bullseye px-3 py-2 text-center text-white"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={
                  reduce
                    ? { scale: 1, opacity: 1 }
                    : { scale: [1, 1.06, 1], opacity: 1 }
                }
                transition={
                  reduce
                    ? { duration: 0.3 }
                    : {
                        opacity: { duration: 0.35, delay: 0.4 },
                        scale: { duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: 0.6 },
                      }
                }
              >
                <p className="text-[10px] uppercase tracking-wider opacity-90">Score</p>
                <p className="font-display text-3xl font-bold leading-none">{board?.scoreLabel ?? '—'}</p>
                <p className="text-[10px] opacity-90">cm</p>
              </motion.div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              {[
                { label: 'Overall', value: board?.overallLabel ?? '—' },
                { label: 'Rank', value: board?.rankLabel ?? '—' },
                { label: 'Team', value: board?.teamLabel ?? '—' },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  className="rounded-md bg-secondary px-2 py-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55 + i * 0.1, duration: 0.35 }}
                >
                  <p className="text-muted-foreground">{stat.label}</p>
                  <p className="mt-0.5 font-semibold text-navy">{stat.value}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="min-w-0 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Leaderboard
            </p>
            <ul className="mt-3 space-y-2">
              {(board?.rows ?? [1, 2, 3].map((rank) => ({
                rank,
                name: '—',
                score: '—',
                total: '—',
                highlight: false,
              }))).map((row, i) => (
                <motion.li
                  key={row.rank}
                  className={`flex min-w-0 items-center gap-2 rounded-md px-2.5 py-2 text-sm ${
                    row.highlight ? 'bg-sky/10 ring-1 ring-sky/30' : 'bg-secondary/70'
                  }`}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.75 + 0.12 * i, duration: 0.4 }}
                >
                  <span className="w-4 shrink-0 text-muted-foreground">{row.rank}</span>
                  <span className="min-w-0 flex-1 truncate font-medium text-navy">{row.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {row.score !== '—' ? <span className="mr-2 text-navy">{row.score}</span> : null}
                    {row.total}
                  </span>
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
      </a>
    </div>
  );
}

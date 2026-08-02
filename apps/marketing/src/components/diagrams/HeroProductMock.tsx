import { useReducedMotion } from 'framer-motion';
import { motion } from 'framer-motion';

const rows = [
  { rank: 1, name: 'A. Rivera', score: '12', total: '48' },
  { rank: 2, name: 'M. Chen', score: '0', total: '51', highlight: true },
  { rank: 3, name: 'S. Okada', score: '18', total: '63' },
];

export function HeroProductMock() {
  const reduce = useReducedMotion();

  return (
    <div
      className="relative mx-auto w-full max-w-lg lg:max-w-none"
      aria-hidden="true"
    >
      <div className="absolute -inset-4 rounded-2xl bg-target-ring opacity-80" />
      <div className="relative overflow-hidden rounded-xl border border-navy/10 bg-white shadow-[0_24px_60px_-24px_rgba(0,36,71,0.45)]">
        <div className="flex items-center gap-2 border-b border-border bg-navy px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-sky" />
          <span className="text-xs font-medium tracking-wide text-white/80">Live competition · Round 4</span>
        </div>

        <div className="grid gap-0 sm:grid-cols-[1.1fr_0.9fr]">
          <div className="border-b border-border p-4 sm:border-b-0 sm:border-r">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Current landing
            </p>
            <div className="mt-3 flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-2xl font-bold text-navy">#42 · M. Chen</p>
                <p className="mt-1 text-sm text-muted-foreground">Team North · Round 4</p>
              </div>
              <motion.div
                className="rounded-lg bg-bullseye px-3 py-2 text-center text-white"
                animate={reduce ? undefined : { scale: [1, 1.04, 1] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <p className="text-[10px] uppercase tracking-wider opacity-90">Score</p>
                <p className="font-display text-3xl font-bold leading-none">0</p>
                <p className="text-[10px] opacity-90">cm</p>
              </motion.div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-md bg-secondary px-2 py-2">
                <p className="text-muted-foreground">Overall</p>
                <p className="mt-0.5 font-semibold text-navy">51 cm</p>
              </div>
              <div className="rounded-md bg-secondary px-2 py-2">
                <p className="text-muted-foreground">Rank</p>
                <p className="mt-0.5 font-semibold text-navy">#2</p>
              </div>
              <div className="rounded-md bg-secondary px-2 py-2">
                <p className="text-muted-foreground">Team</p>
                <p className="mt-0.5 font-semibold text-navy">#1</p>
              </div>
            </div>
          </div>

          <div className="p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Leaderboard
            </p>
            <ul className="mt-3 space-y-2">
              {rows.map((row, i) => (
                <motion.li
                  key={row.rank}
                  className={`flex items-center justify-between rounded-md px-2.5 py-2 text-sm ${
                    row.highlight ? 'bg-sky/10 ring-1 ring-sky/30' : 'bg-secondary/70'
                  }`}
                  initial={reduce ? false : { opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 * i, duration: 0.4 }}
                >
                  <span className="font-medium text-navy">
                    <span className="mr-2 inline-block w-4 text-muted-foreground">{row.rank}</span>
                    {row.name}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    <span className="mr-2 text-navy">{row.score}</span>
                    {row.total}
                  </span>
                </motion.li>
              ))}
            </ul>
            <div className="mt-4 flex gap-1.5">
              {['Rankings', 'Teams', 'Display'].map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-border px-2.5 py-1 text-[10px] font-medium text-muted-foreground"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

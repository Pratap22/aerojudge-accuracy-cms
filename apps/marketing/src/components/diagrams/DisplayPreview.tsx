import { Monitor, Projector, Tv, Wallpaper } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { fadeLeft, inView, motionSafe, staggerContainer, staggerItem } from '@/lib/motion';

const surfaces = [
  { icon: Wallpaper, label: 'LED Wall' },
  { icon: Tv, label: 'TV' },
  { icon: Projector, label: 'Projector' },
  { icon: Monitor, label: 'External Monitor' },
];

export function DisplayPreview() {
  const reduce = useReducedMotion();
  const board = motionSafe(reduce, fadeLeft);
  const grid = motionSafe(reduce, staggerContainer(0.08));

  return (
    <div className="mt-10 grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]">
      <motion.div
        className="overflow-hidden rounded-xl border border-navy/20 bg-[#050d1a] text-white shadow-xl"
        aria-hidden="true"
        {...board}
        viewport={inView}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-sky">
          <span>AeroJudge Display</span>
          <span className="inline-flex items-center gap-1.5">
            <motion.span
              className="h-1.5 w-1.5 rounded-full bg-sky"
              animate={reduce ? undefined : { opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            />
            Full screen · Browser
          </span>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs text-white/50">Current pilot</p>
            <motion.p
              className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl"
              initial={reduce ? false : { opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={inView}
              transition={{ delay: 0.15, duration: 0.4 }}
            >
              #42 · M. Chen
            </motion.p>
            <p className="mt-2 text-sm text-white/65">Round 4 · Team North</p>
            <div className="mt-5 flex flex-wrap gap-4 text-sm">
              <div>
                <p className="text-white/45">Score</p>
                <motion.p
                  className="font-display text-2xl font-bold text-sky"
                  animate={reduce ? undefined : { opacity: [1, 0.7, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  0 cm
                </motion.p>
              </div>
              <div>
                <p className="text-white/45">Overall</p>
                <p className="font-display text-2xl font-bold">51 cm</p>
              </div>
              <div>
                <p className="text-white/45">Rank</p>
                <p className="font-display text-2xl font-bold">#2</p>
              </div>
            </div>
          </div>
          <motion.div
            className="flex h-28 w-28 items-center justify-center rounded-full border-2 border-sky/40 bg-sky/10 sm:h-32 sm:w-32"
            initial={reduce ? false : { scale: 0.9, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={inView}
            transition={{ delay: 0.25, duration: 0.45 }}
          >
            <div className="text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-white/10" />
              <p className="mt-2 text-[10px] uppercase tracking-wider text-white/50">Photo</p>
            </div>
          </motion.div>
        </div>
      </motion.div>

      <motion.ul className="grid grid-cols-2 gap-3" {...grid} viewport={inView}>
        {surfaces.map(({ icon: Icon, label }) => (
          <motion.li
            key={label}
            variants={reduce ? undefined : staggerItem}
            whileHover={reduce ? undefined : { y: -3, borderColor: 'hsl(199 89% 48% / 0.45)' }}
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

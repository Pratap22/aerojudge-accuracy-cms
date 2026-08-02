import { motion, useReducedMotion } from 'framer-motion';
import { Reveal, Stagger, StaggerItem } from '../motion/Reveal';
import { easeOut } from '@/lib/motion';

const outputs = [
  'Individual ranking',
  'Team ranking',
  'LED display',
  'Public results',
  'Reports & printing',
];

export function ScorePropagation() {
  const reduce = useReducedMotion();

  return (
    <div className="mt-10" aria-label="One validated score updates rankings, displays, public results and reports">
      <div className="flex flex-col items-center gap-4">
        <Reveal y={16}>
          <div className="rounded-md border border-border bg-white px-4 py-3 text-sm font-semibold text-navy shadow-sm">
            Judge / Scorer
          </div>
        </Reveal>

        <motion.div
          className="relative h-10 w-px overflow-hidden bg-sky/30"
          initial={{ scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: easeOut }}
          style={{ originY: 0 }}
          aria-hidden
        >
          {!reduce ? (
            <motion.span
              className="absolute inset-x-0 top-0 h-3 bg-sky"
              animate={{ y: [0, 28, 0], opacity: [0.25, 1, 0.25] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
            />
          ) : null}
        </motion.div>

        <Reveal delay={0.15} y={12}>
          <div className="relative rounded-lg bg-navy px-5 py-3 font-display text-lg font-bold text-white shadow-md">
            AeroJudge
            {!reduce ? (
              <motion.span
                className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-sky/40"
                animate={{ opacity: [0.2, 0.6, 0.2], scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                aria-hidden
              />
            ) : null}
          </div>
        </Reveal>

        <motion.div
          className="relative h-10 w-px overflow-hidden bg-sky/30"
          initial={{ scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.25, duration: 0.5, ease: easeOut }}
          style={{ originY: 0 }}
          aria-hidden
        >
          {!reduce ? (
            <motion.span
              className="absolute inset-x-0 top-0 h-3 bg-sky"
              animate={{ y: [0, 28, 0], opacity: [0.25, 1, 0.25] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
            />
          ) : null}
        </motion.div>
      </div>

      <Stagger as="ul" className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" stagger={0.09} delay={0.2}>
        {outputs.map((label) => (
          <StaggerItem key={label} as="li">
            <motion.div
              className="rounded-md border border-sky/25 bg-sky/5 px-3 py-3 text-center text-sm font-medium text-navy"
              whileHover={reduce ? undefined : { y: -3 }}
            >
              {label}
            </motion.div>
          </StaggerItem>
        ))}
      </Stagger>

      <Reveal delay={0.2} y={10} className="mt-6 text-center text-sm text-muted-foreground">
        <p>
          One validated score can refresh rankings, venue boards, public pages and printable reports together.
        </p>
      </Reveal>
    </div>
  );
}

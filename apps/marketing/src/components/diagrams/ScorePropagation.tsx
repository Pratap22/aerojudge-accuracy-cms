import { motion, useReducedMotion } from 'framer-motion';

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
        <div className="rounded-md border border-border bg-white px-4 py-3 text-sm font-semibold text-navy shadow-sm">
          Judge / Scorer
        </div>
        <motion.div
          className="h-8 w-px bg-sky"
          initial={reduce ? false : { scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          style={{ originY: 0 }}
          aria-hidden
        />
        <motion.div
          className="rounded-lg bg-navy px-5 py-3 font-display text-lg font-bold text-white shadow-md"
          initial={reduce ? false : { scale: 0.92, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
        >
          AeroJudge
        </motion.div>
        <motion.div
          className="h-8 w-px bg-sky"
          initial={reduce ? false : { scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15, duration: 0.4 }}
          style={{ originY: 0 }}
          aria-hidden
        />
      </div>

      <ul className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {outputs.map((label, i) => (
          <motion.li
            key={label}
            className="rounded-md border border-sky/25 bg-sky/5 px-3 py-3 text-center text-sm font-medium text-navy"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 * i, duration: 0.35 }}
          >
            {label}
          </motion.li>
        ))}
      </ul>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        One validated score can refresh rankings, venue boards, public pages and printable reports together.
      </p>
    </div>
  );
}

import { ArrowDown } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { easeOut, inView } from '@/lib/motion';

const steps = ['Pilot Scores', 'Team Calculation', 'Team Score', 'Team Ranking'];

export function TeamScoringFlow() {
  const reduce = useReducedMotion();

  return (
    <div className="mt-8" aria-label="Individual scores feed configured team scoring">
      <ol className="flex flex-col items-stretch gap-0 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-2">
        {steps.map((step, index) => (
          <li key={step} className="flex flex-col items-center sm:flex-row sm:gap-2">
            <motion.span
              className="w-full rounded-md border border-border bg-white px-4 py-3 text-center text-sm font-semibold text-navy shadow-sm sm:w-auto"
              initial={reduce ? false : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={inView}
              transition={{ delay: index * 0.12, duration: 0.4, ease: easeOut }}
            >
              {step}
            </motion.span>
            {index < steps.length - 1 ? (
              <>
                <motion.span
                  className="my-1.5 sm:hidden"
                  initial={reduce ? false : { opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={inView}
                  transition={{ delay: index * 0.12 + 0.08 }}
                  aria-hidden
                >
                  <ArrowDown className="h-4 w-4 text-sky" />
                </motion.span>
                <motion.span
                  className="hidden text-sky sm:inline"
                  aria-hidden
                  initial={reduce ? false : { opacity: 0, x: -4 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={inView}
                  transition={{ delay: index * 0.12 + 0.08 }}
                >
                  →
                </motion.span>
              </>
            ) : null}
          </li>
        ))}
      </ol>
      <motion.p
        className="mt-5 text-sm leading-relaxed text-muted-foreground"
        initial={reduce ? false : { opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={inView}
        transition={{ delay: 0.5, duration: 0.4 }}
      >
        Officials can see which pilot scores contributed to a team result according to the competition’s
        configured rule profile — so team standings stay explainable under pressure.
      </motion.p>
    </div>
  );
}

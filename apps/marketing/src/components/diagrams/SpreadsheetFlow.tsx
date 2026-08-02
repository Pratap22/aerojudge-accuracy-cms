import { ArrowDown } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { Stagger, StaggerItem } from '../motion/Reveal';

const steps = [
  'Judge',
  'Paper',
  'Scorer',
  'Spreadsheet',
  'Formula',
  'Leaderboard',
  'PDF',
  'Printer',
  'Notice Board',
];

export function SpreadsheetFlow() {
  const reduce = useReducedMotion();

  return (
    <div className="mt-10" aria-label="Traditional scoring workflow with many manual steps">
      <Stagger as="ol" className="flex flex-col gap-0 sm:hidden" stagger={0.07}>
        {steps.map((step, index) => (
          <StaggerItem key={step} as="li" className="flex flex-col items-center">
            <span className="flex min-h-11 w-full items-center justify-center rounded-md border border-border bg-white px-3 py-2.5 text-sm font-medium text-navy shadow-sm">
              {step}
            </span>
            {index < steps.length - 1 ? (
              <ArrowDown className="my-1.5 h-4 w-4 text-muted-foreground" aria-hidden />
            ) : null}
          </StaggerItem>
        ))}
      </Stagger>

      {/* Flat list — no Fragments (they break Framer stagger) */}
      <Stagger
        as="ol"
        className="hidden flex-wrap items-center justify-center gap-x-1 gap-y-3 sm:flex"
        stagger={0.05}
      >
        {steps.flatMap((step, index) => {
          const items = [
            <StaggerItem
              key={step}
              as="li"
              className="rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-navy shadow-sm"
            >
              {step}
            </StaggerItem>,
          ];
          if (index < steps.length - 1) {
            items.push(
              <StaggerItem key={`${step}-arrow`} as="li" className="px-1 text-muted-foreground">
                <span aria-hidden>→</span>
              </StaggerItem>,
            );
          }
          return items;
        })}
      </Stagger>

      <motion.p
        className="mt-6 text-center text-sm text-muted-foreground"
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ delay: 0.35, duration: 0.4 }}
      >
        Nine hand-offs before the notice board is up to date — and LED displays or public links are still separate.
      </motion.p>
    </div>
  );
}

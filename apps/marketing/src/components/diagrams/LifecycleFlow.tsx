import { motion, useReducedMotion } from 'framer-motion';
import { Stagger, StaggerItem } from '../motion/Reveal';

const stages = [
  'Organization Setup',
  'Competition Setup',
  'Pilot Registration',
  'Team Registration',
  'Rounds',
  'Live Scoring',
  'Automatic Rankings',
  'Chief Judge Review',
  'Official Results',
  'Print / Publish / Display',
  'Competition Archive',
];

export function LifecycleFlow() {
  const reduce = useReducedMotion();

  return (
    <Stagger as="ol" className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" stagger={0.04}>
      {stages.map((stage, index) => (
        <StaggerItem key={stage} as="li">
          <motion.div
            className="relative flex h-full items-center gap-2.5 rounded-lg border border-border bg-white px-3 py-2.5 shadow-sm"
            whileHover={reduce ? undefined : { y: -3, transition: { duration: 0.2 } }}
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy font-display text-sm font-bold text-white"
              aria-hidden
            >
              {index + 1}
            </span>
            <div>
              <p className="font-semibold text-navy">{stage}</p>
              {index < stages.length - 1 ? (
                <p className="mt-1 text-xs text-muted-foreground lg:hidden">Then → {stages[index + 1]}</p>
              ) : null}
            </div>
          </motion.div>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

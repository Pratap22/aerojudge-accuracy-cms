import { motion, useReducedMotion } from 'framer-motion';
import { ScorePropagation } from '../diagrams/ScorePropagation';
import { Stagger, StaggerItem } from '../motion/Reveal';
import { SectionHeading } from '../ui/SectionHeading';

const highlights = [
  'Individual & team ranking',
  'Live leaderboard',
  'LED / venue display',
  'Public results',
  'Official reports & printing',
  'Competition statistics',
];

export function SolutionSection() {
  const reduce = useReducedMotion();

  return (
    <section id="solution" className="section-pad" aria-labelledby="solution-heading">
      <div className="content-width">
        <SectionHeading
          eyebrow="The AeroJudge way"
          title="Enter the score once."
          id="solution-heading"
          description="When a judge or scorer enters a validated score, AeroJudge can update the competition ecosystem that depends on it — rankings, venue displays, public pages and printable reports."
        />
        <ScorePropagation />
        <Stagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" stagger={0.07}>
          {highlights.map((item) => (
            <StaggerItem key={item}>
              <motion.div
                className="rounded-lg border border-border bg-white px-4 py-4 text-sm font-medium text-navy shadow-sm"
                whileHover={reduce ? undefined : { y: -2 }}
              >
                {item}
              </motion.div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

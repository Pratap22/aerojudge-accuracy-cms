import { ScorePropagation } from '../diagrams/ScorePropagation';
import { SectionHeading } from '../ui/SectionHeading';

export function SolutionSection() {
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
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            'Individual & team ranking',
            'Live leaderboard',
            'LED / venue display',
            'Public results',
            'Official reports & printing',
            'Competition statistics',
          ].map((item) => (
            <div key={item} className="rounded-lg border border-border bg-white px-4 py-4 text-sm font-medium text-navy shadow-sm">
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

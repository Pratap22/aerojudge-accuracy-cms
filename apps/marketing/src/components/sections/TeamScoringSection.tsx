import { TeamScoringFlow } from '../diagrams/TeamScoringFlow';
import { SectionHeading } from '../ui/SectionHeading';

export function TeamScoringSection() {
  return (
    <section id="teams" className="section-pad bg-secondary/40" aria-labelledby="teams-heading">
      <div className="content-width">
        <SectionHeading
          eyebrow="Team scoring"
          title="Individual landings. Clear team standings."
          id="teams-heading"
          description="Individual scores feed automatically into the configured team scoring rules — so team rankings stay consistent with the same source of truth as the individual leaderboard."
        />
        <TeamScoringFlow />
      </div>
    </section>
  );
}

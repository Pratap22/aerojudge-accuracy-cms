import { LifecycleFlow } from '../diagrams/LifecycleFlow';
import { SectionHeading } from '../ui/SectionHeading';

export function LifecycleSection() {
  return (
    <section id="lifecycle" className="section-pad bg-secondary/40" aria-labelledby="lifecycle-heading">
      <div className="content-width">
        <SectionHeading
          eyebrow="Competition operations"
          title="More than scoring — the full event path."
          id="lifecycle-heading"
          description="AeroJudge is built as an event operating system: from organization and registration through live rounds, approvals, publishing and archive."
        />
        <LifecycleFlow />
      </div>
    </section>
  );
}

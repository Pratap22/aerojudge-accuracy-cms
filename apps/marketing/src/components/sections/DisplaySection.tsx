import { DisplayPreview } from '../diagrams/DisplayPreview';
import { SectionHeading } from '../ui/SectionHeading';

export function DisplaySection() {
  return (
    <section id="display" className="section-pad bg-secondary/40" aria-labelledby="display-heading">
      <div className="content-width">
        <SectionHeading
          eyebrow="Live display"
          title="Put the competition on the wall."
          id="display-heading"
          description="AeroJudge Display runs in a browser and can be shown full-screen on a computer connected to the event display system — LED wall, TV, projector or external monitor."
        />
        <DisplayPreview />
      </div>
    </section>
  );
}

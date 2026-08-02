import { PrintPreview } from '../diagrams/PrintPreview';
import { SectionHeading } from '../ui/SectionHeading';

export function PrintingSection() {
  return (
    <section id="printing" className="section-pad" aria-labelledby="printing-heading">
      <div className="content-width">
        <SectionHeading
          eyebrow="Official results & printing"
          title="From approval to the notice board."
          id="printing-heading"
          description="Competition officials still need physical result sheets. AeroJudge supports the path from reviewed results to branded PDFs — with page numbers, timestamps, optional signatures and QR links to live results where configured."
        />
        <PrintPreview />
        <ul className="mt-8 flex flex-wrap gap-2">
          {[
            'Round results',
            'Overall results',
            'Team results',
            'Competition branding',
            'Archived versions',
          ].map((item) => (
            <li
              key={item}
              className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-navy"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

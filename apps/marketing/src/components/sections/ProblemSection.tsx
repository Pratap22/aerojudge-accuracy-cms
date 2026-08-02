import { SpreadsheetFlow } from '../diagrams/SpreadsheetFlow';
import { SectionHeading } from '../ui/SectionHeading';

const problems = [
  'Scores entered manually from paper or radio',
  'Multiple sheets for rounds, teams and categories',
  'Formula mistakes that surface late',
  'Manual rankings and team calculations',
  'Copying results between systems and displays',
  'Printing and notice-board updates by hand',
  'LED boards updated separately from the scoring file',
  'Difficulty sharing live results with pilots',
  'Multiple versions of “the” results file',
  'Thin audit trails when a score is corrected',
  'Last-minute fixes under time pressure',
  'Officials depending on one spreadsheet operator',
];

export function ProblemSection() {
  return (
    <section id="problem" className="section-pad bg-secondary/40" aria-labelledby="problem-heading">
      <div className="content-width">
        <SectionHeading
          eyebrow="Traditional competition management"
          title="Competitions move fast. Spreadsheets don't."
          id="problem-heading"
          description="Spreadsheets work well at the start of an event. As rounds stack up, teams need updating, displays need refreshing and officials need a single source of truth — coordination becomes the hard part."
        />
        <SpreadsheetFlow />
        <ul className="mt-12 columns-1 gap-x-10 space-y-2.5 sm:columns-2">
          {problems.map((item) => (
            <li key={item} className="break-inside-avoid text-sm leading-relaxed text-muted-foreground">
              <span className="mr-2 text-sky" aria-hidden>
                ▹
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

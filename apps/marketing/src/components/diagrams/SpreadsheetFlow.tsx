import { ArrowDown } from 'lucide-react';
import { Fragment } from 'react';

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
  return (
    <div className="mt-10" aria-label="Traditional scoring workflow with many manual steps">
      <ol className="flex flex-col gap-0 sm:hidden">
        {steps.map((step, index) => (
          <li key={step} className="flex flex-col items-center">
            <span className="flex min-h-11 w-full items-center justify-center rounded-md border border-border bg-white px-3 py-2.5 text-sm font-medium text-navy shadow-sm">
              {step}
            </span>
            {index < steps.length - 1 ? (
              <ArrowDown className="my-1.5 h-4 w-4 text-muted-foreground" aria-hidden />
            ) : null}
          </li>
        ))}
      </ol>

      <ol className="hidden flex-wrap items-center justify-center gap-x-1 gap-y-3 sm:flex">
        {steps.map((step, index) => (
          <Fragment key={step}>
            <li className="rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-navy shadow-sm">
              {step}
            </li>
            {index < steps.length - 1 ? (
              <li aria-hidden className="px-1 text-muted-foreground">
                →
              </li>
            ) : null}
          </Fragment>
        ))}
      </ol>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Nine hand-offs before the notice board is up to date — and LED displays or public links are still separate.
      </p>
    </div>
  );
}

import { ArrowDown } from 'lucide-react';

const steps = ['Pilot Scores', 'Team Calculation', 'Team Score', 'Team Ranking'];

export function TeamScoringFlow() {
  return (
    <div className="mt-8" aria-label="Individual scores feed configured team scoring">
      <ol className="flex flex-col items-stretch gap-0 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-2">
        {steps.map((step, index) => (
          <li key={step} className="flex flex-col items-center sm:flex-row sm:gap-2">
            <span className="w-full rounded-md border border-border bg-white px-4 py-3 text-center text-sm font-semibold text-navy shadow-sm sm:w-auto">
              {step}
            </span>
            {index < steps.length - 1 ? (
              <>
                <ArrowDown className="my-1.5 h-4 w-4 text-sky sm:hidden" aria-hidden />
                <span className="hidden text-sky sm:inline" aria-hidden>
                  →
                </span>
              </>
            ) : null}
          </li>
        ))}
      </ol>
      <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
        Officials can see which pilot scores contributed to a team result according to the competition’s
        configured rule profile — so team standings stay explainable under pressure.
      </p>
    </div>
  );
}

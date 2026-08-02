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
  return (
    <ol
      className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      aria-label="Competition lifecycle managed by AeroJudge"
    >
      {stages.map((stage, index) => (
        <li
          key={stage}
          className="relative flex items-start gap-3 rounded-lg border border-border bg-white p-4 shadow-sm"
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
        </li>
      ))}
    </ol>
  );
}

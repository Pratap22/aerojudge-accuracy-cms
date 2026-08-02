const printSteps = [
  'Round Completed',
  'Results Reviewed',
  'Approved',
  'Official PDF',
  'Print',
  'Notice Board',
  'Online Results',
];

export function PrintPreview() {
  return (
    <div className="mt-10 grid items-start gap-8 lg:grid-cols-[0.9fr_1.1fr]">
      <ol className="space-y-2" aria-label="Official results print workflow">
        {printSteps.map((step, index) => (
          <li key={step} className="flex items-center gap-3 text-sm">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
              {index + 1}
            </span>
            <span className="font-medium text-navy">{step}</span>
          </li>
        ))}
      </ol>

      <div
        className="mx-auto w-full max-w-md overflow-hidden rounded-sm border border-border bg-white shadow-[0_20px_50px_-28px_rgba(0,36,71,0.5)]"
        style={{ aspectRatio: '210 / 297' }}
        aria-hidden="true"
      >
        <div className="flex h-full flex-col p-[6%]">
          <div className="flex items-start justify-between border-b border-navy/15 pb-3">
            <div>
              <p className="font-display text-sm font-bold text-navy">Overall Results</p>
              <p className="text-[10px] text-muted-foreground">Competition branding · Official</p>
            </div>
            <div className="h-8 w-8 rounded border border-dashed border-navy/30" />
          </div>
          <div className="mt-3 flex-1 space-y-1.5 text-[9px] leading-relaxed text-navy/80">
            {['1 · A. Rivera · 48 cm', '2 · M. Chen · 51 cm', '3 · S. Okada · 63 cm', '4 · J. Silva · 71 cm'].map(
              (line) => (
                <div key={line} className="flex justify-between border-b border-border/80 py-1">
                  <span>{line.split(' · ').slice(0, 2).join(' · ')}</span>
                  <span className="tabular-nums">{line.split(' · ').at(-1)}</span>
                </div>
              ),
            )}
            <div className="pt-3 text-[8px] text-muted-foreground">
              Page 1 of 2 · Generated with timestamp · QR to live results
            </div>
          </div>
          <div className="mt-auto grid grid-cols-2 gap-4 border-t border-navy/10 pt-3">
            <div className="h-8 border-b border-navy/25" />
            <div className="h-8 border-b border-navy/25" />
          </div>
          <p className="mt-1 text-[7px] text-muted-foreground">Signatures where configured</p>
        </div>
      </div>
    </div>
  );
}

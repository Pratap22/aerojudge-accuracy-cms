export function AeroJudgeMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="6" className="fill-navy" />
      <circle cx="16" cy="16" r="8" className="stroke-sky" strokeWidth="2" />
      <circle cx="16" cy="16" r="2.5" className="fill-sky" />
    </svg>
  );
}

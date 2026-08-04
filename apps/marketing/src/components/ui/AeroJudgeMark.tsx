type AeroJudgeMarkProps = {
  className?: string;
  /** Footer / dark backgrounds use a sky accent on navy. */
  variant?: 'default' | 'onDark';
};

export function AeroJudgeMark({ className = 'h-8 w-8', variant = 'default' }: AeroJudgeMarkProps) {
  const frame = variant === 'onDark' ? 'fill-sky' : 'fill-primary';
  const ring = variant === 'onDark' ? 'stroke-white' : 'stroke-sky';
  const center = variant === 'onDark' ? 'fill-white' : 'fill-sky';

  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="6" className={frame} />
      <circle cx="16" cy="16" r="8" className={ring} strokeWidth="2" />
      <circle cx="16" cy="16" r="2.5" className={center} />
    </svg>
  );
}

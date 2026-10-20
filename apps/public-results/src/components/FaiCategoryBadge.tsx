import { faiCategoryLabel } from '@aero-judge/shared';

export function FaiCategoryBadge({ value }: { value?: string | null }) {
  const label = faiCategoryLabel(value);
  if (!label) return null;
  return (
    <span className="inline-flex rounded-full border border-sky-700/25 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-sky-800 dark:border-sky-400/40 dark:bg-sky-500/15 dark:text-sky-100">
      {label}
    </span>
  );
}

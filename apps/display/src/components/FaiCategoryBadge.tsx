import { faiCategoryLabel } from '@aero-judge/shared';

export function FaiCategoryBadge({ value }: { value?: string | null }) {
  const label = faiCategoryLabel(value);
  if (!label) return null;
  return (
    <span className="inline-flex rounded-full border border-sky-400/40 bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-100 sm:text-xs">
      {label}
    </span>
  );
}

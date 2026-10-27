import { faiCategoryLabel } from '@aero-judge/shared';

export function FaiCategoryBadge({
  value,
  onPhoto = false,
}: {
  value?: string | null;
  onPhoto?: boolean;
}) {
  const label = faiCategoryLabel(value);
  if (!label) return null;
  return (
    <span
      className={
        onPhoto
          ? 'inline-flex rounded-full border border-white/40 bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white'
          : 'inline-flex rounded-full border border-sky-700/25 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-sky-800 dark:border-sky-400/40 dark:bg-sky-500/15 dark:text-sky-100'
      }
    >
      {label}
    </span>
  );
}

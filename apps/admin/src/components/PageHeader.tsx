import type { ReactNode } from 'react';
import { cn } from '@npha/ui';

/**
 * Shared page chrome for admin screens — stacks cleanly on mobile,
 * actions full-width on narrow viewports.
 */
export function PageHeader({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0 space-y-1.5">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        {description ? (
          <div className="text-sm text-muted-foreground sm:text-base">{description}</div>
        ) : null}
        {children}
      </div>
      {actions ? (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

import * as React from 'react';

import { padPilotNumber } from '@aero-judge/utils';

import { cn } from '../lib/utils';

export interface PilotChipProps extends React.HTMLAttributes<HTMLDivElement> {
  pilotNumber: number;
  firstName: string;
  lastName: string;
  /** ISO 3166-1 alpha-2 country code for flag emoji */
  countryCode2?: string;
  /** Optional flag image URL */
  flagUrl?: string;
  /** Pilot headshot URL */
  photoUrl?: string | null;
  /** Highlight as current pilot */
  isActive?: boolean;
  size?: 'sm' | 'default' | 'lg';
  /** ISO country code shown beside the flag on the stacked layout */
  countryCode?: string;
}

function countryCodeToEmoji(code2: string): string {
  const upper = code2.trim().toUpperCase();
  if (upper.length !== 2 || upper === 'XX' || !/^[A-Z]{2}$/.test(upper)) return '';
  return String.fromCodePoint(...upper.split('').map((char) => 127397 + char.charCodeAt(0)));
}

const sizeClasses = {
  sm: 'gap-1.5 px-2 py-1 text-xs',
  default: 'gap-2 px-3 py-1.5 text-sm',
  lg: 'gap-3 px-4 py-2 text-base',
} as const;

const numberSizeClasses = {
  sm: 'h-5 min-w-5 px-1 text-[10px]',
  default: 'h-6 min-w-6 px-1 text-xs',
  lg: 'h-8 min-w-8 px-1.5 text-sm',
} as const;

const photoSizeClasses = {
  sm: 'h-5 w-5',
  default: 'h-6 w-6',
  lg: 'h-8 w-8',
} as const;

export function PilotChip({
  pilotNumber,
  firstName,
  lastName,
  countryCode2,
  flagUrl,
  photoUrl,
  isActive = false,
  size = 'default',
  countryCode,
  className,
  ...props
}: PilotChipProps) {
  const flagEmoji = countryCode2 ? countryCodeToEmoji(countryCode2) : null;
  const bib = padPilotNumber(pilotNumber);
  const name = `${firstName} ${lastName}`.trim();
  const countryLabel = countryCode2 ? `Country ${countryCode2}` : undefined;

  const photo = photoUrl ? (
    <img
      src={photoUrl}
      alt=""
      className={cn(
        'shrink-0 rounded-full object-cover object-top ring-1 ring-border',
        photoSizeClasses[size],
      )}
    />
  ) : null;

  const numberBadge = (overlay: boolean) => (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-mono font-bold tabular-nums',
        overlay ? 'bg-primary/15 text-primary' : 'bg-primary text-primary-foreground',
        overlay
          ? size === 'sm'
            ? 'h-4 min-w-4 px-1 text-[9px]'
            : size === 'lg'
              ? 'h-6 min-w-6 px-1.5 text-xs'
              : 'h-5 min-w-5 px-1 text-[10px]'
          : numberSizeClasses[size],
      )}
    >
      {bib}
    </span>
  );

  const countryMark = (withCode: boolean) =>
    flagUrl || flagEmoji || (withCode && countryCode) ? (
      <span className="inline-flex shrink-0 items-center gap-1" aria-label={countryLabel}>
        {flagUrl ? (
          <img src={flagUrl} alt="" className="h-4 w-6 rounded-sm object-cover" />
        ) : flagEmoji ? (
          <span className="text-base leading-none" aria-hidden>
            {flagEmoji}
          </span>
        ) : null}
        {withCode && countryCode ? (
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {countryCode}
          </span>
        ) : null}
      </span>
    ) : null;

  return (
    <div className={cn('max-w-full font-medium', className)} {...props}>
      <div className="flex min-w-0 flex-col gap-1 md:hidden">
        <div className="flex min-w-0 items-center gap-2">
          {photo}
          <span className="min-w-0 truncate text-card-foreground">{name}</span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          {numberBadge(false)}
          {countryMark(true)}
        </div>
      </div>

      <div
        className={cn(
          'hidden max-w-full items-center rounded-full border border-border bg-card text-card-foreground transition-colors md:inline-flex',
          sizeClasses[size],
          isActive &&
            'border-accent bg-accent/10 ring-2 ring-accent ring-offset-2 ring-offset-background',
        )}
      >
        {photo ?? numberBadge(false)}
        {photo ? numberBadge(true) : null}
        <span className="min-w-0 truncate text-card-foreground">{name}</span>
        {countryMark(false) ? <span className="ml-auto">{countryMark(false)}</span> : null}
      </div>
    </div>
  );
}

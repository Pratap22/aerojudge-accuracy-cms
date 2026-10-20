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

const numberSizeClasses = {
  sm: 'h-5 min-w-5 px-1 text-[10px]',
  default: 'h-6 min-w-6 px-1 text-xs',
  lg: 'h-8 min-w-8 px-1.5 text-sm',
} as const;

const photoSizeClasses = {
  sm: 'h-9 w-9',
  default: 'h-12 w-12',
  lg: 'h-14 w-14',
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

  const photo = (
    photoUrl ? (
      <img
        src={photoUrl}
        alt=""
        className={cn(
          'row-span-2 shrink-0 rounded-full object-cover object-top ring-1 ring-border',
          photoSizeClasses[size],
        )}
      />
    ) : (
      <span
        className={cn('row-span-2 shrink-0 rounded-full bg-muted', photoSizeClasses[size])}
        aria-hidden
      />
    )
  );

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
    <div
      className={cn(
        'grid min-w-0 max-w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 font-medium',
        isActive && 'rounded-xl bg-accent/10 ring-2 ring-accent',
        className,
      )}
      {...props}
    >
      {photo}
      <span className="min-w-0 truncate leading-tight text-card-foreground">{name}</span>
      <span className="flex min-w-0 items-center gap-1.5">
        {numberBadge(false)}
        {countryMark(true)}
      </span>
    </div>
  );
}

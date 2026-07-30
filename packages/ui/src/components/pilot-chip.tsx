import * as React from 'react';

import { cn } from '../lib/utils';

export interface PilotChipProps extends React.HTMLAttributes<HTMLDivElement> {
  pilotNumber: number;
  firstName: string;
  lastName: string;
  /** ISO 3166-1 alpha-2 country code for flag emoji */
  countryCode2?: string;
  /** Optional flag image URL */
  flagUrl?: string;
  /** Highlight as current pilot */
  isActive?: boolean;
  size?: 'sm' | 'default' | 'lg';
}

function countryCodeToEmoji(code2: string): string {
  const upper = code2.toUpperCase();
  if (upper.length !== 2) return '';
  return String.fromCodePoint(
    ...upper.split('').map((char) => 127397 + char.charCodeAt(0)),
  );
}

const sizeClasses = {
  sm: 'gap-1.5 px-2 py-1 text-xs',
  default: 'gap-2 px-3 py-1.5 text-sm',
  lg: 'gap-3 px-4 py-2 text-base',
} as const;

const numberSizeClasses = {
  sm: 'h-5 w-5 text-[10px]',
  default: 'h-6 w-6 text-xs',
  lg: 'h-8 w-8 text-sm',
} as const;

export function PilotChip({
  pilotNumber,
  firstName,
  lastName,
  countryCode2,
  flagUrl,
  isActive = false,
  size = 'default',
  className,
  ...props
}: PilotChipProps) {
  const flagEmoji = countryCode2 ? countryCodeToEmoji(countryCode2) : null;

  return (
    <div
      className={cn(
        'inline-flex max-w-full items-center rounded-full border border-border bg-card text-card-foreground font-medium transition-colors',
        sizeClasses[size],
        isActive && 'border-accent bg-accent/10 ring-2 ring-accent ring-offset-2 ring-offset-background',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground',
          numberSizeClasses[size],
        )}
      >
        {pilotNumber}
      </span>

      <span className="min-w-0 truncate text-card-foreground">
        {firstName} {lastName}
      </span>

      {(flagUrl || flagEmoji) && (
        <span className="ml-auto shrink-0" aria-label={countryCode2 ? `Country ${countryCode2}` : undefined}>
          {flagUrl ? (
            <img src={flagUrl} alt="" className="h-4 w-6 rounded-sm object-cover" />
          ) : (
            <span className="text-base leading-none">{flagEmoji}</span>
          )}
        </span>
      )}
    </div>
  );
}

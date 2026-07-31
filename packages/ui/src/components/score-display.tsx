import * as React from 'react';
import { Target } from 'lucide-react';
import { formatScoreCm } from '@npha/utils';

import { cn } from '../lib/utils';

export interface ScoreDisplayProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Score value in centimetres, or null for non-measured results */
  scoreCm: number | null;
  /** Whether this is a bullseye (0 cm) */
  isBullseye?: boolean;
  /** Result type label e.g. DNF, DNS */
  resultLabel?: string;
  /** Display size variant */
  size?: 'default' | 'lg' | 'xl' | 'led';
  /** Show unit suffix */
  showUnit?: boolean;
  /** Pilot name for LED context */
  pilotName?: string;
  /** Pilot number badge */
  pilotNumber?: number;
}

const sizeClasses = {
  default: 'text-4xl',
  lg: 'text-6xl',
  xl: 'text-8xl',
  led: 'text-[10rem] leading-none',
} as const;

export function ScoreDisplay({
  scoreCm,
  isBullseye = false,
  resultLabel,
  size = 'default',
  showUnit = true,
  pilotName,
  pilotNumber,
  className,
  ...props
}: ScoreDisplayProps) {
  const isNonMeasured = resultLabel != null || scoreCm == null;
  const bullseye = isBullseye || scoreCm === 0;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border bg-card p-6 text-center transition-all',
        bullseye && 'border-[hsl(var(--score-bullseye))] bg-[hsl(var(--score-bullseye)/0.08)] score-bullseye-glow',
        size === 'led' && 'min-h-[280px] border-2 bg-[hsl(var(--navy))] text-white dark:bg-[hsl(var(--navy))]',
        className,
      )}
      {...props}
    >
      {(pilotNumber != null || pilotName) && (
        <div
          className={cn(
            'mb-4 flex items-center gap-3 text-sm font-medium uppercase tracking-wider',
            size === 'led' ? 'text-sky-300' : 'text-muted-foreground',
          )}
        >
          {pilotNumber != null && (
            <span
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-full font-bold',
                size === 'led'
                  ? 'bg-sky-500 text-white'
                  : 'bg-primary text-primary-foreground',
              )}
            >
              {pilotNumber}
            </span>
          )}
          {pilotName && <span>{pilotName}</span>}
        </div>
      )}

      {isNonMeasured ? (
        <div
          className={cn(
            'font-bold uppercase tracking-wide text-muted-foreground',
            sizeClasses[size],
            size === 'led' && 'text-amber-400',
          )}
        >
          {resultLabel ?? '—'}
        </div>
      ) : (
        <div className="flex items-baseline gap-2">
          {bullseye && (
            <Target
              className={cn(
                'shrink-0 text-[hsl(var(--score-bullseye))]',
                size === 'led' ? 'h-16 w-16' : size === 'xl' ? 'h-12 w-12' : 'h-8 w-8',
              )}
              aria-hidden
            />
          )}
          <span
            className={cn(
              'font-mono font-bold tabular-nums tracking-tight',
              sizeClasses[size],
              bullseye && 'text-[hsl(var(--score-bullseye))]',
              size === 'led' && !bullseye && 'text-white',
            )}
          >
            {formatScoreCm(scoreCm)}
          </span>
          {showUnit && (
            <span
              className={cn(
                'font-medium text-muted-foreground',
                size === 'led' ? 'text-4xl text-sky-300' : size === 'xl' ? 'text-3xl' : 'text-xl',
              )}
            >
              cm
            </span>
          )}
        </div>
      )}

      {bullseye && !isNonMeasured && (
        <p
          className={cn(
            'mt-3 text-sm font-semibold uppercase tracking-widest text-[hsl(var(--score-bullseye))]',
            size === 'led' && 'text-lg text-emerald-400',
          )}
        >
          Bullseye
        </p>
      )}
    </div>
  );
}

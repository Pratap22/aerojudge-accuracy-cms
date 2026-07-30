import * as React from 'react';
import { Medal } from 'lucide-react';

import { cn } from '../lib/utils';

export interface RankBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  rank: number;
  /** Show medal icon for top 3 */
  showIcon?: boolean;
  size?: 'sm' | 'default' | 'lg';
}

const rankStyles: Record<number, string> = {
  1: 'bg-[hsl(var(--rank-gold)/0.15)] text-[hsl(var(--rank-gold))] border-[hsl(var(--rank-gold)/0.4)]',
  2: 'bg-[hsl(var(--rank-silver)/0.15)] text-[hsl(var(--rank-silver))] border-[hsl(var(--rank-silver)/0.4)]',
  3: 'bg-[hsl(var(--rank-bronze)/0.15)] text-[hsl(var(--rank-bronze))] border-[hsl(var(--rank-bronze)/0.4)]',
};

const medalColors: Record<number, string> = {
  1: 'text-[hsl(var(--rank-gold))]',
  2: 'text-[hsl(var(--rank-silver))]',
  3: 'text-[hsl(var(--rank-bronze))]',
};

const sizeClasses = {
  sm: 'h-6 min-w-6 text-xs',
  default: 'h-8 min-w-8 text-sm',
  lg: 'h-10 min-w-10 text-base',
} as const;

export function RankBadge({
  rank,
  showIcon = true,
  size = 'default',
  className,
  ...props
}: RankBadgeProps) {
  const isPodium = rank >= 1 && rank <= 3;
  const style = isPodium ? rankStyles[rank] : 'bg-muted text-muted-foreground border-border';

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center gap-1 rounded-full border font-bold tabular-nums',
        sizeClasses[size],
        style,
        className,
      )}
      aria-label={`Rank ${rank}`}
      {...props}
    >
      {showIcon && isPodium && (
        <Medal className={cn('h-3.5 w-3.5', medalColors[rank], size === 'lg' && 'h-4 w-4')} />
      )}
      <span>{rank}</span>
    </div>
  );
}

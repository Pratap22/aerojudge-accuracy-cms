import { ExternalLink } from 'lucide-react';
import { Button } from '@npha/ui';
import { openStaffApp } from '../lib/staff-app';

/** Open the Judge scoring terminal with the current staff session. */
export function SwitchToScoringButton({
  className,
  compact = false,
  variant = 'outline',
  onNavigate,
}: {
  className?: string;
  compact?: boolean;
  variant?: 'outline' | 'ghost';
  /** Optional hook (e.g. close mobile nav) before switching. */
  onNavigate?: () => void;
}) {
  return (
    <Button
      type="button"
      variant={variant}
      size={compact ? 'icon' : 'sm'}
      onClick={() => {
        onNavigate?.();
        openStaffApp('judge');
      }}
      className={className}
      title="Switch to scoring terminal"
      aria-label="Switch to scoring terminal"
    >
      <ExternalLink className={compact ? 'h-4 w-4' : 'mr-2 h-4 w-4'} />
      {compact ? null : 'Scoring terminal'}
    </Button>
  );
}

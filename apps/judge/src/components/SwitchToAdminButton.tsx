import { ExternalLink } from 'lucide-react';
import { Button } from '@npha/ui';
import { openStaffApp } from '../lib/staff-app';

/** Open Admin with the current staff session (reports, rounds, ops). */
export function SwitchToAdminButton({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => openStaffApp('admin')}
      className={className}
      title="Switch to Admin"
    >
      <ExternalLink className={compact ? 'h-4 w-4' : 'mr-2 h-4 w-4'} />
      {compact ? <span className="sr-only">Admin</span> : 'Admin'}
    </Button>
  );
}

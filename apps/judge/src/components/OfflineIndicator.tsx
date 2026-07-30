import { Wifi, WifiOff, CloudOff } from 'lucide-react';
import { Badge } from '@npha/ui';
import { cn } from '@npha/ui';

interface OfflineIndicatorProps {
  pendingCount: number;
  isOnline: boolean;
  className?: string;
}

export function OfflineIndicator({ pendingCount, isOnline, className }: OfflineIndicatorProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {isOnline ? (
        <Badge variant="success" className="gap-1 px-3 py-1">
          <Wifi className="h-3.5 w-3.5" />
          Online
        </Badge>
      ) : (
        <Badge variant="warning" className="gap-1 px-3 py-1">
          <WifiOff className="h-3.5 w-3.5" />
          Offline
        </Badge>
      )}
      {pendingCount > 0 && (
        <Badge variant="destructive" className="gap-1 px-3 py-1">
          <CloudOff className="h-3.5 w-3.5" />
          {pendingCount} pending
        </Badge>
      )}
    </div>
  );
}

import { useState, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { Download, RefreshCw, Smartphone, X } from 'lucide-react';
import { Button } from '@aero-judge/ui';
import {
  applyPwaUpdate,
  dismissOfflineReady,
  getPwaSnapshot,
  promptPwaInstall,
  subscribePwa,
} from '../lib/pwa';

/**
 * Install and update notices for the judge PWA.
 * Hidden on the live keypad so a banner cannot cover score entry.
 */
export function PwaStatus() {
  const location = useLocation();
  const state = useSyncExternalStore(subscribePwa, getPwaSnapshot, getPwaSnapshot);
  const [installHidden, setInstallHidden] = useState(false);
  const onScoreScreen = location.pathname.includes('/score/');

  if (onScoreScreen) return null;

  const showInstall = !installHidden && (state.canInstall || state.iosInstall);
  const showOffline = state.offlineReady;
  const showUpdate = state.needRefresh;

  if (!showInstall && !showOffline && !showUpdate) return null;

  return (
    <div className="space-y-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      {showUpdate && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-sm text-foreground">
          <p>A scoring update is ready. Apply it between pilots.</p>
          <Button size="sm" onClick={() => void applyPwaUpdate()}>
            <RefreshCw className="h-4 w-4" />
            Update
          </Button>
        </div>
      )}

      {showOffline && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
          <p>Scoring screen is saved on this device for a dropped connection.</p>
          <Button size="icon" variant="ghost" aria-label="Dismiss" onClick={dismissOfflineReady}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {showInstall && state.canInstall && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Smartphone className="h-4 w-4 text-sky-400" />
            <p>Install AeroJudge on this device for full-screen scoring.</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="ghost" onClick={() => setInstallHidden(true)}>
              Not now
            </Button>
            <Button size="sm" onClick={() => void promptPwaInstall()}>
              <Download className="h-4 w-4" />
              Install
            </Button>
          </div>
        </div>
      )}

      {showInstall && state.iosInstall && !state.canInstall && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
          <p>
            Add AeroJudge to your Home Screen from the Safari share menu, then open it from the
            icon.
          </p>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Dismiss"
            onClick={() => setInstallHidden(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

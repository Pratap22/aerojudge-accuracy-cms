import { useEffect, useState } from 'react';
import { Button, Input, Label } from '@aero-judge/ui';

export interface WindDraft {
  speedMs: number;
  directionDeg: number;
}

interface WindSpeedDialogProps {
  open: boolean;
  title: string;
  confirmLabel: string;
  initialSpeed?: number | null;
  initialDirection?: number | null;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (wind: WindDraft) => void;
}

export function WindSpeedDialog({
  open,
  title,
  confirmLabel,
  initialSpeed,
  initialDirection,
  busy,
  error,
  onClose,
  onConfirm,
}: WindSpeedDialogProps) {
  const [speed, setSpeed] = useState('');
  const [direction, setDirection] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSpeed(initialSpeed != null ? String(initialSpeed) : '');
    setDirection(initialDirection != null ? String(Math.round(initialDirection)) : '');
    setLocalError(null);
  }, [open, initialSpeed, initialDirection]);

  if (!open) return null;

  const submit = () => {
    const speedMs = Number(speed);
    const directionDeg = direction.trim() === '' ? (initialDirection ?? 0) : Number(direction);
    if (!Number.isFinite(speedMs) || speedMs < 0) {
      setLocalError('Enter a wind speed of 0 m/s or more.');
      return;
    }
    if (!Number.isFinite(directionDeg) || directionDeg < 0 || directionDeg > 360) {
      setLocalError('Direction must be between 0 and 360.');
      return;
    }
    setLocalError(null);
    onConfirm({ speedMs, directionDeg });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wind-dialog-title"
        className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-4 text-white shadow-xl"
      >
        <h2 id="wind-dialog-title" className="text-lg font-semibold">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          This is the wind shown on the live boards until the next update.
        </p>
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="wind-speed" className="text-slate-300">
              Speed (m/s)
            </Label>
            <Input
              id="wind-speed"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.1"
              value={speed}
              onChange={(e) => setSpeed(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wind-direction" className="text-slate-300">
              Direction (°)
            </Label>
            <Input
              id="wind-direction"
              type="number"
              inputMode="numeric"
              min={0}
              max={360}
              step="1"
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
            />
          </div>
          {(localError || error) && <p className="text-sm text-red-400">{localError || error}</p>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

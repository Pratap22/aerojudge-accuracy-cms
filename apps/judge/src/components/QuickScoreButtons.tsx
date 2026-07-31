import type { ScoreResultType } from '@npha/shared';
import { Button, cn } from '@npha/ui';

interface QuickScoreButtonsProps {
  selected: ScoreResultType;
  onSelect: (type: ScoreResultType, distanceCm: number | null) => void;
  disabled?: boolean;
  maximumScoreCm?: number;
}

export function QuickScoreButtons({
  selected,
  onSelect,
  disabled,
  maximumScoreCm = 1000,
}: QuickScoreButtonsProps) {
  const buttons: {
    type: ScoreResultType;
    label: string;
    distance: number | null;
    className: string;
  }[] = [
    {
      type: 'BULLSEYE',
      label: 'Bullseye',
      distance: 0,
      className: 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500',
    },
    {
      type: 'DNF',
      label: 'DNF',
      distance: null,
      className: 'bg-red-600 hover:bg-red-500 border-red-500',
    },
    {
      type: 'ABS',
      label: 'ABS',
      distance: null,
      className: 'bg-orange-600 hover:bg-orange-500 border-orange-500',
    },
    {
      type: 'DNS',
      label: 'DNS',
      distance: null,
      className: 'bg-amber-600 hover:bg-amber-500 border-amber-500',
    },
    {
      type: 'REFLIGHT',
      label: 'Reflight',
      distance: null,
      className: 'bg-blue-600 hover:bg-blue-500 border-blue-500',
    },
    {
      type: 'MAXIMUM',
      label: 'Max',
      distance: maximumScoreCm,
      className: 'bg-slate-600 hover:bg-slate-500 border-slate-500',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
      {buttons.map(({ type, label, distance, className }) => (
        <Button
          key={type}
          type="button"
          disabled={disabled}
          className={cn(
            'h-11 px-1 text-sm font-bold text-white border-2 transition-transform active:scale-95 sm:h-12 sm:text-base',
            className,
            selected === type
              ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-900'
              : 'border-transparent opacity-90',
          )}
          onClick={() => onSelect(type, distance)}
          aria-pressed={selected === type}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

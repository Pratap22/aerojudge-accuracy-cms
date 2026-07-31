import { Delete } from 'lucide-react';
import { formatScoreCm } from '@npha/utils';
import { Button, cn } from '@npha/ui';

interface NumericKeypadProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
}

const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', '⌫'];

export function NumericKeypad({ value, onChange, onSubmit, disabled }: NumericKeypadProps) {
  const handleKey = (key: string) => {
    if (disabled) return;
    if (key === '⌫') {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === '.' && value.includes('.')) return;
    if (value.length >= 6) return;
    onChange(value + key);
  };

  const displayValue =
    value === '' || value === '.'
      ? '000'
      : value.endsWith('.')
        ? `${formatScoreCm(Number(value.slice(0, -1) || 0))}.`
        : formatScoreCm(Number(value));

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-slate-800 px-6 py-4 text-center">
        <span className="font-mono text-score text-sky-400">{displayValue}</span>
        <span className="ml-2 text-2xl text-slate-400">cm</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {keys.map((key) => (
          <Button
            key={key}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              'h-16 text-2xl font-semibold bg-slate-800 border-slate-700 hover:bg-slate-700 active:scale-95 transition-transform',
              key === '⌫' && 'col-span-1',
            )}
            onClick={() => handleKey(key)}
          >
            {key === '⌫' ? <Delete className="h-6 w-6" /> : key}
          </Button>
        ))}
      </div>
      {onSubmit && (
        <Button
          type="button"
          size="lg"
          className="h-14 w-full text-lg"
          disabled={disabled || !value}
          onClick={onSubmit}
        >
          Confirm Distance
        </Button>
      )}
    </div>
  );
}

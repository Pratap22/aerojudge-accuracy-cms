import { useEffect, useRef, useState } from 'react';
import { Delete } from 'lucide-react';
import { formatScoreCm } from '@npha/utils';
import { Button, cn } from '@npha/ui';

interface NumericKeypadProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  /** Fill remaining height in a flex parent (scoring terminal). */
  fill?: boolean;
  /** Listen for physical keyboard when true (e.g. pilot picker closed). */
  keyboardEnabled?: boolean;
}

const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', '⌫'];

export function NumericKeypad({
  value,
  onChange,
  onSubmit,
  disabled,
  fill = false,
  keyboardEnabled = false,
}: NumericKeypadProps) {
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const disabledRef = useRef(disabled);
  const flashTimer = useRef<number | null>(null);

  valueRef.current = value;
  onChangeRef.current = onChange;
  disabledRef.current = disabled;

  const flashKey = (key: string) => {
    setPressedKey(key);
    if (flashTimer.current != null) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setPressedKey(null), 120);
  };

  const handleKey = (key: string) => {
    if (disabledRef.current) return;
    flashKey(key);
    const current = valueRef.current;
    if (key === '⌫') {
      onChangeRef.current(current.slice(0, -1));
      return;
    }
    if (key === '.' && current.includes('.')) return;
    if (current.length >= 6) return;
    onChangeRef.current(current + key);
  };

  const handleKeyRef = useRef(handleKey);
  handleKeyRef.current = handleKey;

  useEffect(() => {
    if (!keyboardEnabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (disabledRef.current) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      let padKey: string | null = null;
      if (e.key >= '0' && e.key <= '9') padKey = e.key;
      else if (e.key === '.') padKey = '.';
      else if (e.key === 'Backspace' || e.key === 'Delete') padKey = '⌫';

      if (!padKey) return;
      e.preventDefault();
      handleKeyRef.current(padKey);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [keyboardEnabled]);

  useEffect(() => {
    return () => {
      if (flashTimer.current != null) window.clearTimeout(flashTimer.current);
    };
  }, []);

  const displayValue =
    value === '' || value === '.'
      ? '000'
      : value.endsWith('.')
        ? `${formatScoreCm(Number(value.slice(0, -1) || 0))}.`
        : formatScoreCm(Number(value));

  return (
    <div className={cn('flex min-h-0 flex-col gap-2', fill && 'h-full')}>
      <div
        className={cn(
          'shrink-0 rounded-xl bg-slate-800 text-center',
          fill ? 'px-3 py-2' : 'px-4 py-2.5',
        )}
      >
        <span
          className={cn(
            'font-mono font-bold tabular-nums text-sky-400',
            fill ? 'text-3xl sm:text-4xl' : 'text-4xl sm:text-5xl',
          )}
        >
          {displayValue}
        </span>
        <span className={cn('ml-2 text-slate-400', fill ? 'text-base' : 'text-lg')}>cm</span>
      </div>
      <div
        className={cn('grid min-h-0 flex-1 grid-cols-3 gap-1.5', fill && 'grid-rows-4')}
        style={fill ? { gridTemplateRows: 'repeat(4, minmax(0, 1fr))' } : undefined}
      >
        {keys.map((key) => (
          <Button
            key={key}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              'font-semibold bg-slate-800 border-slate-700 hover:bg-slate-700 active:scale-95 transition-transform',
              fill ? 'h-full min-h-0 text-lg sm:text-xl' : 'h-14 text-xl',
              pressedKey === key && 'scale-95 bg-slate-700',
            )}
            onClick={() => handleKey(key)}
          >
            {key === '⌫' ? <Delete className="h-5 w-5" /> : key}
          </Button>
        ))}
      </div>
      {onSubmit && (
        <Button
          type="button"
          size="lg"
          className="h-12 w-full shrink-0 text-base"
          disabled={disabled || !value}
          onClick={onSubmit}
        >
          Confirm Distance
        </Button>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import type { ScoreResultType } from '@npha/shared';
import { cn, Input } from '@npha/ui';
import { formatScoreCm, padPilotNumber } from '@npha/utils';

export interface PilotOption {
  id: string;
  pilotNumber: number;
  firstName: string;
  lastName: string;
  status?: string;
  distanceCm?: number | null;
  resultType?: ScoreResultType | null;
  finalScoreCm?: number | null;
}

interface PilotDisplayProps {
  pilots: PilotOption[];
  selectedId: string | null;
  onSelect: (flightId: string) => void;
  firstName: string;
  lastName: string;
  country: string;
  countryCode?: string;
  className?: string;
  onOpenChange?: (open: boolean) => void;
}

function countryFlag(code?: string): string {
  if (!code || code.length !== 2 || code.toUpperCase() === 'XX') return '';
  if (!/^[A-Za-z]{2}$/.test(code)) return '';
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join('');
}

function formatPilotNo(n: number): string {
  return padPilotNumber(n, 2);
}

function formatPickerScore(p: PilotOption): string | null {
  const type = p.resultType;
  const hasScore =
    p.status === 'SCORED' || type != null || p.finalScoreCm != null || p.distanceCm != null;
  if (!hasScore) return null;
  if (type === 'BULLSEYE' || (p.distanceCm === 0 && type === 'MEASURED')) return '0';
  if (type && type !== 'MEASURED' && type !== 'MAXIMUM') return type;
  if (p.finalScoreCm != null) return formatScoreCm(p.finalScoreCm);
  if (p.distanceCm != null) return formatScoreCm(p.distanceCm);
  return '—';
}

/** Compact pilot switcher for the no-scroll scoring terminal. */
export function PilotDisplay({
  pilots,
  selectedId,
  onSelect,
  firstName,
  lastName,
  country,
  countryCode,
  className,
  onOpenChange,
}: PilotDisplayProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = pilots.find((p) => p.id === selectedId);
  const flag = countryFlag(countryCode);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = !q
      ? pilots
      : (() => {
          const digits = q.replace(/^0+/, '') || '0';
          return pilots.filter((p) => {
            const padded = formatPilotNo(p.pilotNumber).toLowerCase();
            const raw = String(p.pilotNumber);
            return (
              padded.includes(q) ||
              raw.includes(q) ||
              raw.includes(digits) ||
              padded.includes(digits.padStart(2, '0'))
            );
          });
        })();
    return list.slice().sort((a, b) => a.pilotNumber - b.pilotNumber);
  }, [pilots, query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open]);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => searchRef.current?.focus(), 50);
      return () => window.clearTimeout(id);
    }
    setQuery('');
  }, [open]);

  const pick = (flightId: string) => {
    onSelect(flightId);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className={cn('relative w-full', className)} ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-left outline-none ring-sky-500 transition-colors hover:bg-slate-800 focus-visible:ring-2 active:bg-slate-800"
      >
        <span className="flex h-12 min-w-[5.5rem] shrink-0 items-center justify-center gap-1 rounded-lg bg-slate-900 px-3 font-mono text-2xl font-black text-sky-400">
          {selected ? formatPilotNo(selected.pilotNumber) : '—'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-semibold leading-tight text-white">
            {firstName} {lastName}
          </span>
          <span className="block truncate text-sm text-slate-400">
            {flag ? <span className="mr-1">{flag}</span> : null}
            {country || '—'}
          </span>
        </span>
        <ChevronDown
          className={cn(
            'h-5 w-5 shrink-0 text-slate-400 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-md border border-slate-600 bg-slate-900 shadow-xl">
          <div className="border-b border-slate-700 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pilot number…"
                inputMode="numeric"
                className="h-10 border-slate-600 bg-slate-800 pl-9 font-mono text-base text-white placeholder:text-slate-500"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setOpen(false);
                    setQuery('');
                  }
                  if (e.key === 'Enter' && filtered[0]) {
                    e.preventDefault();
                    pick(filtered[0].id);
                  }
                }}
              />
            </div>
          </div>
          <ul role="listbox" className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-4 text-sm text-slate-500">No pilot matches “{query}”</li>
            ) : (
              filtered.map((p) => {
                const isSelected = p.id === selectedId;
                const scoreLabel = formatPickerScore(p);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={cn(
                        'flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-800',
                        isSelected && 'bg-slate-800/80',
                      )}
                      onClick={() => pick(p.id)}
                    >
                      {isSelected ? (
                        <Check className="h-4 w-4 shrink-0 text-sky-400" />
                      ) : (
                        <span className="w-4 shrink-0" />
                      )}
                      <span className="font-mono text-xl font-black text-sky-400">
                        {formatPilotNo(p.pilotNumber)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-200">
                        {p.firstName} {p.lastName}
                      </span>
                      {scoreLabel != null && (
                        <>
                          <span className="shrink-0 text-xs text-slate-500">scored</span>
                          <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-sky-300">
                            {scoreLabel}
                          </span>
                        </>
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

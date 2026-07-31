import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, User } from 'lucide-react';
import { cn, Input } from '@npha/ui';
import { padPilotNumber } from '@npha/utils';

export interface PilotOption {
  id: string;
  pilotNumber: number;
  firstName: string;
  lastName: string;
  status?: string;
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

export function PilotDisplay({
  pilots,
  selectedId,
  onSelect,
  firstName,
  lastName,
  country,
  countryCode,
  className,
}: PilotDisplayProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = pilots.find((p) => p.id === selectedId);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pilots;
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
    <div className={cn('flex flex-col items-center text-center', className)}>
      <div className="mb-4 flex h-32 w-32 items-center justify-center rounded-2xl bg-slate-800 ring-4 ring-sky-500/30">
        <User className="h-16 w-16 text-slate-500" />
      </div>

      <div className="relative mb-3 w-full max-w-sm" ref={rootRef}>
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => setOpen((v) => !v)}
          className="flex h-16 w-full items-center justify-center gap-2 rounded-md border border-slate-600 bg-slate-800 px-4 text-sky-400 outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          <span className="font-mono text-2xl font-black">
            {selected ? formatPilotNo(selected.pilotNumber) : 'Select pilot'}
          </span>
          <ChevronDown className={cn('h-5 w-5 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
        </button>

        {open && (
          <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-md border border-slate-600 bg-slate-900 shadow-xl">
            <div className="border-b border-slate-700 p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search pilot number…"
                  inputMode="numeric"
                  className="h-11 border-slate-600 bg-slate-800 pl-9 font-mono text-lg text-white placeholder:text-slate-500"
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
            <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <li className="px-4 py-6 text-sm text-slate-500">No pilot matches “{query}”</li>
              ) : (
                filtered.map((p) => {
                  const isSelected = p.id === selectedId;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        className={cn(
                          'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-800',
                          isSelected && 'bg-slate-800/80',
                        )}
                        onClick={() => pick(p.id)}
                      >
                        {isSelected ? (
                          <Check className="h-4 w-4 shrink-0 text-sky-400" />
                        ) : (
                          <span className="w-4 shrink-0" />
                        )}
                        <span className="font-mono text-2xl font-black text-sky-400">
                          {formatPilotNo(p.pilotNumber)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-base text-slate-200">
                          {p.firstName} {p.lastName}
                        </span>
                        {p.status === 'SCORED' && (
                          <span className="shrink-0 text-xs text-slate-500">scored</span>
                        )}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
        <p className="mt-2 text-xs text-slate-500">Search or tap pilot number to switch</p>
      </div>

      <h2 className="text-3xl font-bold tracking-tight">
        {firstName} {lastName}
      </h2>
      <div className="mt-2 flex items-center gap-2 text-xl text-slate-300">
        {countryFlag(countryCode) && <span className="text-3xl">{countryFlag(countryCode)}</span>}
        <span>{country}</span>
      </div>
    </div>
  );
}

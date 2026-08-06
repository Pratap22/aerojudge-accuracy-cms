import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Button, Input, cn } from '@npha/ui';
import { api } from '../lib/api';

export interface CountryOption {
  id: string;
  code: string;
  code2: string;
  name: string;
}

export function useCountries(enabled = true) {
  return useQuery({
    queryKey: ['countries'],
    queryFn: () => api.get<CountryOption[]>('/public/countries'),
    staleTime: 60 * 60 * 1000,
    enabled,
  });
}

/** Resolve a stored country id / ISO code / name to a CountryOption. */
export function findCountry(
  countries: CountryOption[] | undefined,
  hint: string | null | undefined,
): CountryOption | undefined {
  const raw = hint?.trim();
  if (!raw || !countries?.length) return undefined;
  const upper = raw.toUpperCase();
  const lower = raw.toLowerCase();
  return (
    countries.find((c) => c.id === raw) ??
    countries.find((c) => c.code2.toUpperCase() === upper) ??
    countries.find((c) => c.code.toUpperCase() === upper) ??
    countries.find((c) => c.name.toLowerCase() === lower)
  );
}

function countryLabel(c: CountryOption): string {
  return `${c.name} (${c.code2 || c.code})`;
}

interface CountrySelectProps {
  value?: string | null;
  /** Called with the selected country, or null when cleared. */
  onChange: (country: CountryOption | null) => void;
  disabled?: boolean;
  placeholder?: string;
  allowClear?: boolean;
  className?: string;
  triggerClassName?: string;
  id?: string;
}

/**
 * Searchable country picker backed by the shared Country reference table.
 * `value` may be a country id, ISO code, or English name — it is resolved to the list.
 */
export function CountrySelect({
  value,
  onChange,
  disabled,
  placeholder = 'Select country',
  allowClear = true,
  className,
  triggerClassName,
  id,
}: CountrySelectProps) {
  const { data: countries = [], isLoading } = useCountries();
  const selected = useMemo(() => findCountry(countries, value), [countries, value]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.code2.toLowerCase().includes(q),
    );
  }, [countries, query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => searchRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  const selectCountry = (country: CountryOption | null) => {
    onChange(country);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <Button
        id={id}
        type="button"
        variant="outline"
        disabled={disabled || isLoading}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          'h-10 w-full justify-between px-3 font-normal',
          !selected && 'text-muted-foreground',
          triggerClassName,
        )}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="truncate">
          {isLoading ? 'Loading…' : selected ? countryLabel(selected) : placeholder}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center gap-2 border-b px-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search countries…"
              className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-2"
              autoComplete="off"
            />
          </div>
          <ul role="listbox" className="max-h-60 overflow-auto py-1">
            {allowClear && (
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={!selected}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => selectCountry(null)}
                >
                  <Check className={cn('h-4 w-4', selected ? 'opacity-0' : 'opacity-100')} />
                  <span>Not specified</span>
                </button>
              </li>
            )}
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">No countries found</li>
            ) : (
              filtered.map((c) => {
                const isSelected = selected?.id === c.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => selectCountry(c)}
                    >
                      <Check className={cn('h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                      <span className="truncate">{countryLabel(c)}</span>
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

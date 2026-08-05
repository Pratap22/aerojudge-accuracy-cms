import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from '@npha/ui';
import { api } from '../lib/api';

export interface CountryOption {
  id: string;
  code: string;
  code2: string;
  name: string;
}

const NONE = '__none__';

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
 * Country dropdown backed by the shared Country reference table.
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
  const selectValue = selected?.id ?? (allowClear ? NONE : undefined);

  return (
    <div className={cn(className)}>
      <Select
        value={selectValue}
        disabled={disabled || isLoading}
        onValueChange={(next) => {
          if (next === NONE) {
            onChange(null);
            return;
          }
          onChange(countries.find((c) => c.id === next) ?? null);
        }}
      >
        <SelectTrigger id={id} className={triggerClassName}>
          <SelectValue placeholder={isLoading ? 'Loading…' : placeholder} />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {allowClear && <SelectItem value={NONE}>Not specified</SelectItem>}
          {countries.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name} ({c.code2 || c.code})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

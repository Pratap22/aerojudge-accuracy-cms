import { User } from 'lucide-react';
import {
  cn,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@npha/ui';

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
  if (!code || code.length !== 2) return '🏳️';
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join('');
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
  return (
    <div className={cn('flex flex-col items-center text-center', className)}>
      <div className="mb-4 flex h-32 w-32 items-center justify-center rounded-2xl bg-slate-800 ring-4 ring-sky-500/30">
        <User className="h-16 w-16 text-slate-500" />
      </div>

      <div className="mb-3 w-full max-w-sm">
        <Select value={selectedId ?? undefined} onValueChange={onSelect}>
          <SelectTrigger className="h-16 border-slate-600 bg-slate-800 px-4 focus:ring-sky-500 [&>span]:line-clamp-none [&>span]:flex [&>span]:w-full [&>span]:items-center [&>span]:justify-center">
            <SelectValue placeholder="Select pilot #" />
          </SelectTrigger>
          <SelectContent className="max-h-80 border-slate-600 bg-slate-900 text-white">
            {pilots.map((p) => (
              <SelectItem
                key={p.id}
                value={p.id}
                className="cursor-pointer py-3 focus:bg-slate-800 focus:text-white"
                textValue={`#${p.pilotNumber} ${p.firstName} ${p.lastName}`}
              >
                <span className="flex w-full items-center gap-3">
                  <span className="font-mono text-2xl font-black text-sky-400">#{p.pilotNumber}</span>
                  <span className="text-base text-slate-200">
                    {p.firstName} {p.lastName}
                  </span>
                  {p.status === 'SCORED' && (
                    <span className="ml-auto text-xs text-slate-500">scored</span>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-2 text-xs text-slate-500">Tap pilot # to switch</p>
      </div>

      <h2 className="text-3xl font-bold tracking-tight">
        {firstName} {lastName}
      </h2>
      <div className="mt-2 flex items-center gap-2 text-xl text-slate-300">
        <span className="text-3xl">{countryFlag(countryCode)}</span>
        <span>{country}</span>
      </div>
    </div>
  );
}

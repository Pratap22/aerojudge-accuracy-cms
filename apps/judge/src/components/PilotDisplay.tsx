import { User } from 'lucide-react';
import { cn } from '@npha/ui';

interface PilotDisplayProps {
  pilotNumber: number;
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
  pilotNumber,
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
      <div className="mb-2 font-mono text-6xl font-black text-sky-400">{pilotNumber}</div>
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

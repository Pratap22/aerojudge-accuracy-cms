import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Button, cn } from '@aero-judge/ui';
import type { RoundStatus } from '@aero-judge/shared';
import { api } from '../lib/api';
import { competitionDrawClosed } from '../lib/pilot-draw';
import {
  competitionPath,
  useCompetitionId,
  useRouteOrganizationId,
} from '../hooks/useCompetitionId';

interface DrawPilot {
  id: string;
  pilotNumber: number | null;
  firstName: string;
  lastName: string;
  civlId?: string | null;
  nationality?: string | null;
}

const SLICE_COLORS = ['#1e3a5f', '#0f766e', '#9a3412', '#1d4ed8'];

function freePilotNumbers(pilots: DrawPilot[]): number[] {
  const assigned = new Set(
    pilots.map((pilot) => pilot.pilotNumber).filter((number): number is number => number != null),
  );
  const needed = pilots.filter((pilot) => pilot.pilotNumber == null).length;
  const numbers: number[] = [];
  let candidate = 1;
  while (numbers.length < needed) {
    if (!assigned.has(candidate)) numbers.push(candidate);
    candidate += 1;
  }
  return numbers;
}

function pilotName(pilot: DrawPilot): string {
  return `${pilot.firstName} ${pilot.lastName}`.trim();
}

export function PilotNumberDrawPage() {
  const competitionId = useCompetitionId();
  const organizationId = useRouteOrganizationId();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [pendingNumber, setPendingNumber] = useState<number | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const landedNumber = useRef<number | null>(null);

  const { data: rounds = [], isLoading: roundsLoading } = useQuery({
    queryKey: ['rounds', competitionId],
    queryFn: () =>
      api.get<{ status: RoundStatus }[]>(`/competitions/${competitionId}/rounds`),
    enabled: !!competitionId,
  });
  const drawClosed = competitionDrawClosed(rounds);

  const { data: pilots = [], isLoading } = useQuery({
    queryKey: ['pilots', competitionId, 'number-draw'],
    queryFn: async () => {
      const collected: DrawPilot[] = [];
      let page = 1;
      let total = Number.POSITIVE_INFINITY;
      while (collected.length < total && page <= 10) {
        const response = await api.getPage<DrawPilot[]>(
          `/competitions/${competitionId}/pilots`,
          { page, pageSize: 200 },
        );
        const batch = response.data ?? [];
        total = response.meta?.total ?? batch.length;
        collected.push(...batch);
        if (batch.length === 0) break;
        page += 1;
      }
      return collected;
    },
    enabled: !!competitionId,
  });

  const waiting = useMemo(
    () => pilots.filter((pilot) => pilot.pilotNumber == null).sort((a, b) => pilotName(a).localeCompare(pilotName(b))),
    [pilots],
  );
  const numbers = useMemo(() => freePilotNumbers(pilots), [pilots]);
  const selected = waiting.find((pilot) => pilot.id === selectedId) ?? null;
  const assignedCount = pilots.length - waiting.length;

  const assignMutation = useMutation({
    mutationFn: async ({ pilotId, pilotNumber }: { pilotId: string; pilotNumber: number }) =>
      api.put(`/competitions/${competitionId}/pilots/${pilotId}`, { pilotNumber }),
    onSuccess: async () => {
      setPendingNumber(null);
      setSelectedId(null);
      setAssignError(null);
      await queryClient.invalidateQueries({ queryKey: ['pilots', competitionId] });
    },
    onError: (error: Error) => {
      setAssignError(error.message || 'Could not assign that number');
    },
  });

  function spin() {
    if (!selected || spinning || numbers.length === 0 || assignMutation.isPending) return;
    const index = Math.floor(Math.random() * numbers.length);
    const slice = 360 / numbers.length;
    const center = index * slice + slice / 2;
    const landing = (360 - center) % 360;
    landedNumber.current = numbers[index];
    setPendingNumber(null);
    setAssignError(null);
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setRotation((prev) => {
        const normalized = ((prev % 360) + 360) % 360;
        const delta = (landing - normalized + 360) % 360;
        return prev + delta;
      });
      setPendingNumber(numbers[index]);
      return;
    }
    setSpinning(true);
    setRotation((prev) => {
      const normalized = ((prev % 360) + 360) % 360;
      const delta = (landing - normalized + 360) % 360;
      return prev + 6 * 360 + delta;
    });
  }

  function onWheelSettled(event: React.TransitionEvent<HTMLDivElement>) {
    if (event.propertyName !== 'transform' || !spinning) return;
    setSpinning(false);
    setPendingNumber(landedNumber.current);
  }

  if (!competitionId || !organizationId) {
    return <p className="text-muted-foreground">Open a competition first.</p>;
  }

  if (roundsLoading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (drawClosed) {
    return (
      <div className="space-y-4">
        <Link
          to={competitionPath(organizationId, competitionId, 'pilots')}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Pilots
        </Link>
        <h1 className="text-2xl font-bold">Pilot number draw</h1>
        <p className="text-muted-foreground">
          A round has already started, so pilot numbers are no longer drawn.
        </p>
      </div>
    );
  }

  const slice = numbers.length > 0 ? 360 / numbers.length : 360;
  const showRimNumbers = numbers.length > 0 && numbers.length <= 36;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            to={competitionPath(organizationId, competitionId, 'pilots')}
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Pilots
          </Link>
          <h1 className="text-2xl font-bold">Pilot number draw</h1>
          <p className="text-muted-foreground">
            Choose a pilot, spin, then assign the number. Numbers already given out stay off the wheel.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {assignedCount} assigned · {waiting.length} waiting
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading pilots…</p>
      ) : pilots.length === 0 ? (
        <p className="text-muted-foreground">Import or add pilots before the draw.</p>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)_minmax(16rem,20rem)]">
          <section className="rounded-lg border">
            <h2 className="border-b px-4 py-3 text-sm font-semibold">Waiting for a number</h2>
            <ul className="max-h-[32rem] overflow-y-auto p-2">
              {waiting.length === 0 ? (
                <li className="px-2 py-6 text-center text-sm text-muted-foreground">
                  Every pilot has a number.
                </li>
              ) : (
                waiting.map((pilot) => (
                  <li key={pilot.id}>
                    <button
                      type="button"
                      disabled={spinning || assignMutation.isPending}
                      onClick={() => {
                        setSelectedId(pilot.id);
                        setPendingNumber(null);
                        setAssignError(null);
                      }}
                      className={cn(
                        'flex w-full flex-col rounded-md px-3 py-2 text-left hover:bg-muted',
                        selectedId === pilot.id && 'bg-primary/10 ring-1 ring-primary',
                      )}
                    >
                      <span className="font-medium">{pilotName(pilot)}</span>
                      <span className="text-xs text-muted-foreground">
                        {[pilot.civlId ? `CIVL ${pilot.civlId}` : null, pilot.nationality]
                          .filter(Boolean)
                          .join(' · ') || 'No CIVL ID'}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="flex flex-col items-center gap-5">
            <div className="relative h-[min(92vw,28rem)] w-[min(92vw,28rem)]">
              <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2">
                <div className="h-0 w-0 border-x-[10px] border-t-[16px] border-x-transparent border-t-foreground" />
              </div>
              <div
                className="absolute inset-3 rounded-full shadow-md"
                onTransitionEnd={onWheelSettled}
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: spinning
                    ? 'transform 4.8s cubic-bezier(0.12, 0.55, 0.05, 1)'
                    : 'none',
                  background:
                    numbers.length > 0
                      ? `conic-gradient(${numbers
                          .map(
                            (_, index) =>
                              `${SLICE_COLORS[index % SLICE_COLORS.length]} ${(index / numbers.length) * 100}% ${((index + 1) / numbers.length) * 100}%`,
                          )
                          .join(', ')})`
                      : '#e2e8f0',
                }}
              >
                {showRimNumbers &&
                  numbers.map((number, index) => {
                    const angle = index * slice + slice / 2;
                    return (
                      <span
                        key={number}
                        className="absolute left-1/2 top-1/2 h-0 w-0"
                        style={{ transform: `rotate(${angle}deg)` }}
                      >
                        <span
                          className="absolute left-0 top-0 -translate-x-1/2 text-xs font-semibold text-white"
                          style={{ transform: `translateY(-9.2rem) rotate(${-angle}deg)` }}
                        >
                          {number}
                        </span>
                      </span>
                    );
                  })}
              </div>
              <div className="absolute left-1/2 top-1/2 z-10 flex h-36 w-36 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border bg-background text-center shadow-sm">
                <span className="text-4xl font-bold tabular-nums">
                  {pendingNumber ?? (spinning ? '…' : '—')}
                </span>
                <span className="mt-1 max-w-[8rem] truncate text-xs text-muted-foreground">
                  {selected ? pilotName(selected) : 'Select a pilot'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                size="lg"
                disabled={!selected || spinning || numbers.length === 0 || assignMutation.isPending}
                onClick={spin}
              >
                {spinning ? 'Spinning…' : 'Spin'}
              </Button>
              <Button
                type="button"
                size="lg"
                variant="secondary"
                disabled={
                  pendingNumber == null || !selected || spinning || assignMutation.isPending
                }
                onClick={() => {
                  if (!selected || pendingNumber == null) return;
                  assignMutation.mutate({ pilotId: selected.id, pilotNumber: pendingNumber });
                }}
              >
                {assignMutation.isPending
                  ? 'Assigning…'
                  : pendingNumber != null && selected
                    ? `Assign ${pendingNumber} to ${pilotName(selected)}`
                    : 'Assign'}
              </Button>
            </div>
            {assignError ? <p className="text-sm text-destructive">{assignError}</p> : null}
          </section>

          <section className="rounded-lg border">
            <h2 className="border-b px-4 py-3 text-sm font-semibold">Available numbers</h2>
            <div className="max-h-[32rem] overflow-y-auto p-3">
              {numbers.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No numbers left.</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {numbers.map((number) => (
                    <li
                      key={number}
                      className={cn(
                        'min-w-10 rounded-md border px-2 py-1 text-center font-mono text-sm',
                        pendingNumber === number && 'border-primary bg-primary text-primary-foreground',
                      )}
                    >
                      {number}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

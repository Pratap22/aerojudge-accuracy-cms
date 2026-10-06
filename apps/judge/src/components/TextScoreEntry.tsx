import { useEffect, useRef, useState } from 'react';
import type { EnterScoreInput, ScoreResultType } from '@aero-judge/shared';
import { padPilotNumber } from '@aero-judge/utils';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@aero-judge/ui';
import {
  describeFlightScore,
  flightAlreadyScored,
  parsePilotNumber,
  parseTypedScore,
} from '../lib/text-score';

export interface TextScoreFlight {
  id: string;
  pilotNumber: number;
  firstName: string;
  lastName: string;
  status: string;
  distanceCm: number | null;
  resultType: ScoreResultType | null;
  finalScoreCm?: number | null;
}

interface TextScoreEntryProps {
  flights: TextScoreFlight[];
  maximumScoreCm: number;
  disabled: boolean;
  /** Set when the judge taps a pilot in the list. */
  pilotSeed: { token: number; pilotNumber: number } | null;
  onSubmit: (score: EnterScoreInput) => Promise<'saved' | 'queued' | 'blocked'>;
}

const fieldClass =
  'h-11 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 text-xl font-semibold tabular-nums text-white outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500';

export function TextScoreEntry({
  flights,
  maximumScoreCm,
  disabled,
  pilotSeed,
  onSubmit,
}: TextScoreEntryProps) {
  const pilotRef = useRef<HTMLInputElement>(null);
  const scoreRef = useRef<HTMLInputElement>(null);
  const [pilotRaw, setPilotRaw] = useState('');
  const [scoreRaw, setScoreRaw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{
    score: EnterScoreInput;
    pilotLabel: string;
    name: string;
    existingLabel: string;
    nextLabel: string;
  } | null>(null);

  useEffect(() => {
    pilotRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!pilotSeed) return;
    setPilotRaw(String(pilotSeed.pilotNumber));
    setError(null);
    setNotice(null);
    scoreRef.current?.focus();
  }, [pilotSeed]);

  const pilotNumber = parsePilotNumber(pilotRaw);
  const flight =
    pilotNumber == null ? null : (flights.find((item) => item.pilotNumber === pilotNumber) ?? null);
  const existingLabel = flight ? describeFlightScore(flight) : null;
  const parsedScore = scoreRaw.trim() ? parseTypedScore(scoreRaw, maximumScoreCm) : null;

  function pilotHint(): string | null {
    if (!pilotRaw.trim()) return null;
    if (pilotNumber == null) return 'Use digits for the pilot number';
    if (!flight) return `No pilot ${padPilotNumber(pilotNumber, 2)} in this round`;
    const name = `${flight.firstName} ${flight.lastName}`.trim();
    if (existingLabel) {
      return `${padPilotNumber(flight.pilotNumber, 2)} · ${name} · already ${existingLabel}`;
    }
    return `${padPilotNumber(flight.pilotNumber, 2)} · ${name}`;
  }

  async function commit(score: EnterScoreInput, nextLabel: string, pilotLabel: string) {
    setBusy(true);
    setError(null);
    try {
      const outcome = await onSubmit(score);
      if (outcome === 'blocked') {
        setError('Scores are final for this round.');
        return;
      }
      setPilotRaw('');
      setScoreRaw('');
      setNotice(
        outcome === 'queued'
          ? `Queued ${pilotLabel} · ${nextLabel}. It will sync when you are back online.`
          : `Saved ${pilotLabel} · ${nextLabel}`,
      );
      pilotRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  function requestSave() {
    if (disabled || busy) return;
    setNotice(null);

    if (pilotNumber == null) {
      setError('Enter the pilot number');
      pilotRef.current?.focus();
      return;
    }
    if (!flight) {
      setError(`No pilot ${padPilotNumber(pilotNumber, 2)} in this round`);
      pilotRef.current?.focus();
      return;
    }
    const parsed = parseTypedScore(scoreRaw, maximumScoreCm);
    if (!parsed.ok) {
      setError(parsed.message);
      scoreRef.current?.focus();
      return;
    }

    const score: EnterScoreInput = {
      flightId: flight.id,
      distanceCm: parsed.distanceCm,
      resultType: parsed.resultType,
      penaltyCm: 0,
    };
    const pilotLabel = padPilotNumber(flight.pilotNumber, 2);
    const name = `${flight.firstName} ${flight.lastName}`.trim();

    if (flightAlreadyScored(flight)) {
      setPending({
        score,
        pilotLabel,
        name,
        existingLabel: describeFlightScore(flight) ?? '—',
        nextLabel: parsed.label,
      });
      return;
    }

    void commit(score, parsed.label, pilotLabel);
  }

  const hint = pilotHint();
  const hintIsWarning = !!flight && !!existingLabel;
  const hintIsError = !!pilotRaw.trim() && (!flight || pilotNumber == null);

  return (
    <>
      <form
        className="flex shrink-0 flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          requestSave();
        }}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
          <label className="block min-w-0">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Pilot number
            </span>
            <input
              ref={pilotRef}
              value={pilotRaw}
              onChange={(event) => {
                setPilotRaw(event.target.value);
                setError(null);
                setNotice(null);
              }}
              inputMode="numeric"
              enterKeyHint="next"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              disabled={disabled || busy}
              aria-label="Pilot number"
              className={fieldClass}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  scoreRef.current?.focus();
                }
              }}
            />
          </label>

          <label className="block min-w-0">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Score
            </span>
            <input
              ref={scoreRef}
              value={scoreRaw}
              onChange={(event) => {
                setScoreRaw(event.target.value);
                setError(null);
                setNotice(null);
              }}
              inputMode="decimal"
              enterKeyHint="done"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              disabled={disabled || busy}
              aria-label="Score"
              className={fieldClass}
            />
          </label>

          <Button type="submit" className="h-11 px-4 text-sm font-semibold" disabled={disabled || busy}>
            {busy ? 'Saving…' : 'Confirm'}
          </Button>
        </div>

        {hint || (parsedScore?.ok && scoreRaw.trim()) ? (
          <p
            className={`text-sm ${
              hintIsError ? 'text-amber-300' : hintIsWarning ? 'text-amber-200' : 'text-sky-200'
            }`}
            aria-live="polite"
          >
            {hint}
            {parsedScore?.ok && scoreRaw.trim()
              ? `${hint ? ' · ' : ''}saves as ${parsedScore.label}`
              : ''}
          </p>
        ) : null}

        {error ? (
          <p className="text-sm text-red-300" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="text-sm text-emerald-300" role="status">
            {notice}
          </p>
        ) : null}
      </form>

      <Dialog
        open={pending != null}
        onOpenChange={(open) => {
          if (!open && !busy) setPending(null);
        }}
      >
        <DialogContent
          className="max-w-md"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-xl">Replace this score?</DialogTitle>
            <DialogDescription className="text-base leading-relaxed text-slate-600">
              {pending
                ? `Pilot ${pending.pilotLabel} ${pending.name} already has ${pending.existingLabel}. Save ${pending.nextLabel} instead?`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:gap-2">
            <Button
              type="button"
              variant="secondary"
              className="h-10 text-sm"
              disabled={busy}
              onClick={() => setPending(null)}
            >
              Keep score
            </Button>
            <Button
              type="button"
              className="h-10 text-sm font-semibold"
              disabled={busy || !pending}
              onClick={() => {
                if (!pending) return;
                const next = pending;
                setPending(null);
                void commit(next.score, next.nextLabel, next.pilotLabel);
              }}
            >
              Replace score
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

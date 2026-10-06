import type { ScoreResultType } from '@aero-judge/shared';
import { formatScoreCm } from '@aero-judge/utils';

export interface TypedScoreFlight {
  status: string;
  distanceCm: number | null;
  resultType: ScoreResultType | null;
  finalScoreCm?: number | null;
}

export type ParsedTypedScore =
  | {
      ok: true;
      resultType: ScoreResultType;
      distanceCm: number | null;
      label: string;
    }
  | { ok: false; message: string };

/** "1", "01", and "001" are the same pilot. Blank or non-digits do not match. */
export function parsePilotNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s+/g, '');
  if (!/^\d+$/.test(cleaned)) return null;
  const value = Number.parseInt(cleaned, 10);
  if (!Number.isInteger(value)) return null;
  return value;
}

/**
 * Accepts padded and unpadded distances ("1", "01", "0"), an optional cm suffix,
 * and a comma or dot decimal. Words such as DNF still work from a hardware keyboard.
 */
export function parseTypedScore(raw: string, maximumScoreCm: number): ParsedTypedScore {
  let text = raw.trim().toLowerCase().replace(/\s+/g, '');
  if (!text) return { ok: false, message: 'Enter a score' };

  text = text.replace(/cm$/, '').replace(/\.+$/, '');
  if (!text) return { ok: false, message: 'Enter a score' };

  const words: Record<string, { resultType: ScoreResultType; distanceCm: number | null; label: string }> =
    {
      dnf: { resultType: 'DNF', distanceCm: null, label: 'DNF' },
      dns: { resultType: 'DNS', distanceCm: null, label: 'DNS' },
      abs: { resultType: 'ABS', distanceCm: null, label: 'ABS' },
      dsq: { resultType: 'DSQ', distanceCm: null, label: 'DSQ' },
      max: { resultType: 'MAXIMUM', distanceCm: maximumScoreCm, label: 'Max' },
      maximum: { resultType: 'MAXIMUM', distanceCm: maximumScoreCm, label: 'Max' },
      bullseye: { resultType: 'BULLSEYE', distanceCm: 0, label: '0' },
      bull: { resultType: 'BULLSEYE', distanceCm: 0, label: '0' },
    };

  const word = words[text];
  if (word) return { ok: true, ...word };

  if (text === 'reflight') {
    return {
      ok: false,
      message: 'Use Keypad mode to record a reflight. A reason is required.',
    };
  }

  const numeric = text.replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(numeric)) {
    return { ok: false, message: 'Enter the distance in centimetres' };
  }

  const value = Number(numeric);
  if (!Number.isFinite(value)) {
    return { ok: false, message: 'Enter the distance in centimetres' };
  }
  if (value > maximumScoreCm) {
    return { ok: false, message: `Score cannot be more than ${maximumScoreCm} cm` };
  }
  if (value === 0) {
    return { ok: true, resultType: 'BULLSEYE', distanceCm: 0, label: '0' };
  }
  if (value >= maximumScoreCm) {
    return { ok: true, resultType: 'MAXIMUM', distanceCm: maximumScoreCm, label: 'Max' };
  }

  return {
    ok: true,
    resultType: 'MEASURED',
    distanceCm: value,
    label: formatScoreCm(value),
  };
}

export function flightAlreadyScored(flight: TypedScoreFlight): boolean {
  return (
    flight.status === 'SCORED' ||
    flight.resultType != null ||
    flight.finalScoreCm != null ||
    flight.distanceCm != null
  );
}

export function describeFlightScore(flight: TypedScoreFlight): string | null {
  if (!flightAlreadyScored(flight)) return null;
  const type = flight.resultType;
  if (type === 'BULLSEYE' || (flight.distanceCm === 0 && type === 'MEASURED')) return '0';
  if (type && type !== 'MEASURED' && type !== 'MAXIMUM') return type;
  if (type === 'MAXIMUM') return 'Max';
  if (flight.finalScoreCm != null) return formatScoreCm(flight.finalScoreCm);
  if (flight.distanceCm != null) return formatScoreCm(flight.distanceCm);
  return '—';
}

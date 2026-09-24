/**
 * Time & status helpers for football clocks.
 * Kept pure (no RN imports) so they're unit-testable in the sandbox.
 */

export type StatusGroup = 'scheduled' | 'live' | 'halftime' | 'finished' | 'other';

export type StatusInfo = {
  group: StatusGroup;
  /** short chip text e.g. "67'" */
  chip: string;
  /** whether the minute counter should keep ticking */
  ticking: boolean;
};

const LIVE_SHORT = new Set(['1H', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE']);
const FINISHED = new Set(['FT', 'AET', 'PEN']);
const HALFTIME = new Set(['HT', 'BT']);

export function statusInfo(short: string, elapsed?: number | null): StatusInfo {
  if (HALFTIME.has(short)) {
    return { group: 'halftime', chip: short === 'BT' ? 'B/T' : 'HT', ticking: false };
  }
  if (FINISHED.has(short)) {
    return { group: 'finished', chip: 'FT', ticking: false };
  }
  if (LIVE_SHORT.has(short)) {
    const m = elapsed && elapsed > 0 ? `${elapsed}'` : 'LIVE';
    return { group: 'live', chip: m, ticking: true };
  }
  if (short === 'NS' || short === 'TBD' || short === 'POSTP' || short === 'CANC') {
    return { group: 'scheduled', chip: short === 'NS' ? 'Upcoming' : short, ticking: false };
  }
  return { group: 'other', chip: short, ticking: false };
}

/** "Today / Tomorrow / Sat 12 Sep" for the date strip */
export function friendlyDay(date: Date): string {
  const now = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(date) - startOf(now)) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function toApiDate(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromApiDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Derive TheSportsDB season string ("2024-2025") from a kickoff ISO date. */
export function seasonStringFor(kickoffIso: string): string {
  const d = new Date(kickoffIso);
  const y = isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
  const m = isNaN(d.getTime()) ? new Date().getMonth() : d.getMonth();
  return m >= 6 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

export function daysAround(today: Date, before: number, after: number): Date[] {
  const out: Date[] = [];
  for (let i = -before; i <= after; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    out.push(d);
  }
  return out;
}

/** kickoff label for upcoming matches, e.g. "20:45" or "Sat 20:45" */
export function kickoffLabel(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'TBD';
  const now = new Date();
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  const sameDay =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  if (sameDay) return time;
  const day = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day} · ${time}`;
}

export type ScoreBlock = {
  halftime?: { h: number | null; a: number | null } | null;
  fullTime?: { h: number | null; a: number | null } | null;
  extraTime?: { h: number | null; a: number | null } | null;
  penalty?: { h: number | null; a: number | null } | null;
  aggregate?: { h: number | null; a: number | null } | null;
};

/** extra-time / penalty shootout subtitle, e.g. "a.e.t. 2-1" or "pens 5-4" */
export function scoreSuffix(statusShort: string, score: ScoreBlock): string | null {
  if (statusShort === 'AET') {
    const et = score.extraTime;
    if (et && (et.h !== null || et.a !== null)) return `a.e.t. ${et.h}–${et.a}`;
    return 'after extra time';
  }
  if (statusShort === 'PEN') {
    const p = score.penalty;
    if (p && (p.h !== null || p.a !== null)) return `pens ${p.h}–${p.a}`;
    return 'on penalties';
  }
  if (statusShort === 'P') return 'match pending';
  if (statusShort === 'SUSP') return 'suspended';
  if (statusShort === 'INT') return 'interrupted';
  if (statusShort === 'CANC') return 'cancelled';
  if (statusShort === 'POSTP') return 'postponed';
  if (statusShort === 'ABD') return 'abandoned';
  if (statusShort === 'AWD') return 'awarded';
  if (statusShort === 'WO') return 'walkover';
  return null;
}

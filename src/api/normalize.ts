/**
 * Pure data-normalization for GoalCreed. NO react-native imports —
 * this is the unit-tested core: raw API-Football payloads in,
 * render-ready UI models out.
 */
import type { Fixture, MatchEvent, StatRow, TeamStatistics, TeamLineup, LineupPlayer } from '@/api/types';
import { scoreSuffix, statusInfo, type StatusInfo } from '@/lib/time';

// ---------------------------------------------------------------------------
// Match model
// ---------------------------------------------------------------------------

export type UiMatch = {
  id: number;
  leagueName: string;
  leagueLogo: string;
  leagueFlag: string | null;
  leagueRound: string;
  homeId: number;
  awayId: number;
  homeName: string;
  awayName: string;
  homeShort: string;
  awayShort: string;
  homeLogo: string;
  awayLogo: string;
  homeWinner: boolean;
  awayWinner: boolean;
  goalsHome: number;
  goalsAway: number;
  hasStarted: boolean;
  statusShort: string;
  statusLong: string;
  elapsed: number;
  extraMinute: number;
  status: StatusInfo;
  suffix: string | null;
  kickoff: string;
  timestamp: number;
  venue: string;
  city: string;
  referee: string | null;
  updatedAt: number;
};

/** "Manchester City" → "M'chester City"? Keep smart short names: strip common noise, else last word. */
export function shortTeamName(name: string): string {
  const noise = /^(afc|cf|sc|ac|as|ss|fc|if|bk|cd|ud|rc|rcd|ca|racing club|club)\s+/i;
  const cleaned = name.replace(noise, '').trim();
  if (cleaned.length <= 11) return cleaned || name;
  const words = cleaned.split(' ');
  if (words.length >= 2) return words[words.length - 1];
  return cleaned.slice(0, 12);
}

export function toUiMatch(f: Fixture): UiMatch {
  const st = f.fixture.status;
  const elapsed = st.elapsed ?? 0;
  const extraMinute = st.extra && st.extra > 0 ? st.extra : elapsed;
  return {
    id: f.fixture.id,
    leagueName: f.league.name,
    leagueLogo: f.league.logo,
    leagueFlag: f.league.flag,
    leagueRound: f.league.round || '',
    homeId: f.teams.home.id,
    awayId: f.teams.away.id,
    homeName: f.teams.home.name,
    awayName: f.teams.away.name,
    homeShort: shortTeamName(f.teams.home.name),
    awayShort: shortTeamName(f.teams.away.name),
    homeLogo: f.teams.home.logo,
    awayLogo: f.teams.away.logo,
    homeWinner: !!f.teams.home.winner,
    awayWinner: !!f.teams.away.winner,
    goalsHome: f.goals.home ?? 0,
    goalsAway: f.goals.away ?? 0,
    hasStarted: st.short !== 'NS' && st.short !== 'TBD',
    statusShort: st.short,
    statusLong: st.long,
    elapsed,
    extraMinute,
    status: statusInfo(st.short, elapsed),
    suffix: scoreSuffix(st.short, f.score ?? {}),
    kickoff: f.fixture.date,
    timestamp: f.fixture.timestamp,
    venue: f.fixture.venue?.name ?? '',
    city: f.fixture.venue?.city ?? '',
    referee: f.fixture.referee ?? null,
    updatedAt: f.update * 1000,
  };
}

/** live first (by minute desc), then upcoming by kickoff, finished last. */
export function sortMatches(matches: UiMatch[]): UiMatch[] {
  const rank = (m: UiMatch) => (m.status.group === 'live' ? 0 : m.status.group === 'halftime' ? 1 : m.status.group === 'scheduled' ? 2 : 3);
  return [...matches].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (ra === 0) return b.elapsed - a.elapsed;
    if (ra === 2) return a.timestamp - b.timestamp;
    return b.timestamp - a.timestamp;
  });
}

export type LeagueGroup = {
  key: string;
  name: string;
  logo: string;
  flag: string | null;
  round: string;
  matches: UiMatch[];
};

export function groupByLeague(matches: UiMatch[]): LeagueGroup[] {
  const map = new Map<string, LeagueGroup>();
  for (const m of matches) {
    const key = `${m.leagueName}`;
    let g = map.get(key);
    if (!g) {
      g = { key, name: m.leagueName, logo: m.leagueLogo, flag: m.leagueFlag, round: m.leagueRound, matches: [] };
      map.set(key, g);
    }
    g.matches.push(m);
  }
  const out = [...map.values()];
  for (const g of out) g.matches = sortMatches(g.matches);
  // leagues containing live games float to the top
  out.sort((a, b) => {
    const aLive = a.matches.some((m) => m.status.group === 'live' || m.status.group === 'halftime');
    const bLive = b.matches.some((m) => m.status.group === 'live' || m.status.group === 'halftime');
    if (aLive !== bLive) return aLive ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return out;
}

// ---------------------------------------------------------------------------
// Goal timeline (events feed)
// ---------------------------------------------------------------------------

export type TimelineKind = 'goal' | 'penalty-goal' | 'own-goal' | 'missed-penalty' | 'yellow' | 'red' | 'yellowred' | 'sub' | 'var';

export type TimelineItem = {
  key: string;
  minute: number;
  minuteLabel: string; // "45+2"
  kind: TimelineKind;
  side: 'home' | 'away';
  teamName: string;
  player: string;
  detail: string;
  assist?: string | null;
  playerOut?: string | null;
  photo: string | null;
  period: number; // 1,2,3(ET),4(Pens)
};

export type TimelinePeriod = {
  label: string;
  items: TimelineItem[];
  goalsHome: number;
  goalsAway: number;
};

function classifyEvent(e: MatchEvent): TimelineKind | null {
  const d = (e.detail || '').toLowerCase();
  if (e.type === 'Goal') {
    if (d.includes('penalty')) return d.includes('missed') ? 'missed-penalty' : 'penalty-goal';
    if (d.includes('own')) return 'own-goal';
    return 'goal';
  }
  if (e.type === 'Card') {
    if (d.includes('second yellow')) return 'yellowred';
    if (d.includes('red')) return 'red';
    return 'yellow';
  }
  if (e.type === 'subst') return 'sub';
  if (e.type === 'Var') return d.includes('no') ? null : 'var';
  return null;
}

function periodOf(e: { type: string; elapsed: number; period?: number; detail?: string }): number {
  if (e.period) return e.period;
  const d = (e.detail || '').toLowerCase();
  if (d.includes('penalty shoot') || e.type === 'Pen') return 4;
  return e.elapsed > 90 ? 3 : e.elapsed > 45 ? 2 : 1;
}

export function buildTimeline(events: MatchEvent[], homeId: number): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const e of events) {
    const kind = classifyEvent(e);
    if (!kind) continue;
    const plus = e.extra && e.extra > 0 ? `+${e.extra}` : '';
    items.push({
      key: `${e.team.id}-${e.elapsed}-${e.type}-${e.player.name}-${items.length}`,
      minute: e.elapsed,
      minuteLabel: `${e.elapsed}${plus}'`,
      kind,
      side: e.team.id === homeId ? 'home' : 'away',
      teamName: e.team.name,
      player: e.player?.name || 'Unknown',
      detail: e.detail || '',
      assist: e.assist?.name ? e.assist.name : null,
      playerOut: e.sub?.name ? e.sub.name : null,
      photo: e.player?.photo || null,
      period: periodOf(e),
    });
  }
  items.sort((a, b) => a.minute - b.minute);
  return items;
}

const PERIOD_LABELS: Record<number, string> = { 1: 'First Half', 2: 'Second Half', 3: 'Extra Time', 4: 'Penalties' };

export function groupTimeline(items: TimelineItem[]): TimelinePeriod[] {
  if (!items.length) return [];
  const out: TimelinePeriod[] = [];
  let cur: TimelinePeriod | null = null;
  for (const it of items) {
    if (!cur || cur.label !== PERIOD_LABELS[it.period]) {
      cur = { label: PERIOD_LABELS[it.period] ?? `Period ${it.period}`, items: [], goalsHome: 0, goalsAway: 0 };
      out.push(cur);
    }
    cur.items.push(it);
    if (it.kind === 'goal' || it.kind === 'penalty-goal') {
      if (it.side === 'home') cur.goalsHome++;
      else cur.goalsAway++;
    } else if (it.kind === 'own-goal') {
      if (it.side === 'home') cur.goalsAway++;
      else cur.goalsHome++;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

const STAT_ORDER: [string, string, StatRow['kind']][] = [
  ['Ball Possession', 'Possession', 'pct'],
  ['Expected Goals', 'Expected Goals (xG)', 'count'],
  ['Shots on Goal', 'Shots on Target', 'count'],
  ['Shots off Goal', 'Shots off Target', 'count'],
  ['Blocked Shots', 'Blocked Shots', 'count'],
  ['Total Shots', 'Total Shots', 'count'],
  ['Shots insidebox', 'Shots in the Box', 'count'],
  ['Shots outsidebox', 'Shots outside Box', 'count'],
  ['Goalkeeper Kicks', 'GK Kicks', 'count'],
  ['Goalkeeper Saves', 'GK Saves', 'count'],
  ['Passes %', 'Pass Accuracy', 'pct'],
  ['Passes', 'Total Passes', 'count'],
  ['Passes accurate', 'Accurate Passes', 'count'],
  ['Key passes', 'Key Passes', 'count'],
  ['Corner Kicks', 'Corners', 'count'],
  ['Offside', 'Offsides', 'count'],
  ['Fouls', 'Fouls', 'count'],
  ['Yellow Cards', 'Yellow Cards', 'count'],
  ['Red Cards', 'Red Cards', 'count'],
  ['Total Front Tackles', 'Front Tackles', 'count'],
  ['Interceptions', 'Interceptions', 'count'],
  ['Tackles', 'Tackles', 'count'],
];

export function parseStatValue(v: string | number | null): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (!s || s === 'No Statistic') return null;
  if (s.includes('/')) {
    const first = parseFloat(s.split('/')[0]);
    return isNaN(first) ? null : first;
  }
  const n = parseFloat(s.replace('%', ''));
  return isNaN(n) ? null : n;
}

export function normalizeStats(stats: TeamStatistics[], homeId: number): StatRow[] {
  const home = stats.find((s) => s.team.id === homeId);
  const away = stats.find((s) => s.team.id !== homeId);
  if (!home || !away) return [];
  const byType = (t: TeamStatistics, type: string) => t.statistics.find((x) => x.type === type)?.value ?? null;

  const rows: StatRow[] = [];
  for (const [apiType, label, kind] of STAT_ORDER) {
    const hv = parseStatValue(byType(home, apiType));
    const av = parseStatValue(byType(away, apiType));
    if (hv === null && av === null) continue;
    const h = hv ?? 0;
    const a = av ?? 0;
    const fmt = (n: number) => (kind === 'pct' ? `${Math.round(n)}%` : Number.isInteger(n) ? String(n) : n.toFixed(2));
    rows.push({ key: apiType, label, home: h, away: a, displayHome: fmt(h), displayAway: fmt(a), kind });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Lineups
// ---------------------------------------------------------------------------

export type UiLineupPlayer = LineupPlayer & { x: number; y: number };
export type UiLineup = {
  teamName: string;
  logo: string;
  formation: string;
  coach: string | null;
  starters: UiLineupPlayer[];
  bench: LineupPlayer[];
};

export function parseGrid(grid: string | null): { x: number; y: number } | null {
  if (!grid) return null;
  const [row, col] = grid.split(':').map(Number);
  if (!row || !col) return null;
  return { x: col, y: row }; // col across pitch, GK at bottom row
}

export function toUiLineups(lineups: TeamLineup[], homeId: number): UiLineup[] {
  return lineups.map((l) => {
    const starters: UiLineupPlayer[] = (l.startingXI ?? [])
      .map((p) => {
        const g = parseGrid(p.grid ?? null);
        return { ...p, x: g?.x ?? 0, y: g?.y ?? 0 };
      })
      .sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));
    return {
      teamName: l.team.name,
      logo: l.team.logo,
      formation: l.formation ?? '—',
      coach: l.coach?.name ?? null,
      starters,
      bench: (l.substitutes ?? []).map((p) => ({ ...p, grid: p.grid ?? null })),
    };
  });
}

/** True if the lineup object belongs to the home side. */
export function lineupIsHome(l: TeamLineup, homeId: number): boolean {
  return l.team.id === homeId;
}

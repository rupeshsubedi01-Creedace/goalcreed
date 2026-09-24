/**
 * Shared API-Football (v3) response types — only the fields GoalCreed uses.
 * Pure types module (no runtime imports) so normalization logic stays testable.
 */

export type TeamRef = {
  id: number;
  name: string;
  logo: string;
  winner?: boolean | null;
};

export type LeagueRef = {
  id: number;
  name: string;
  country: string;
  logo: string;
  flag: string | null;
  season: number;
  round: string;
};

export type FixtureScore = {
  halftime?: { h: number | null; a: number | null } | null;
  fullTime?: { h: number | null; a: number | null } | null;
  extraTime?: { h: number | null; a: number | null } | null;
  penalty?: { h: number | null; a: number | null } | null;
  aggregate?: { h: number | null; a: number | null } | null;
};

export type Fixture = {
  fixture: {
    id: number;
    referee: string | null;
    timezone: string;
    date: string;
    timestamp: number;
    venue: { id: number | null; name: string | null; city: string | null } | null;
    status: { long: string; short: string; elapsed: number | null; extra: number | null };
  };
  league: LeagueRef;
  teams: { home: TeamRef; away: TeamRef };
  goals: { home: number | null; away: number | null };
  score: FixtureScore;
  update: number;
  startTimestamp?: number; // injected when grouped
};

export type MatchEvent = {
  team: TeamRef;
  player: { id: number | null; name: string; photo: string };
  assist: { id: number | null; name: string; photo: string } | null;
  type: 'Goal' | 'Card' | 'subst' | 'Var' | string;
  detail: string;
  sub: { id: number; name: string; photo: string } | null;
  elapsed: number;
  extra: number | null;
  period?: number; // injected (1|2|ET|P)
  side?: 'home' | 'away'; // injected
  isGoal?: boolean; // injected
  isMissedPen?: boolean; // injected
  card?: 'yellow' | 'red' | 'yellowred' | null; // injected
};

export type MatchStat = {
  type: string;
  value: string | number | null;
};

export type TeamStatistics = {
  team: TeamRef;
  statistics: MatchStat[];
};

export type StatRow = {
  key: string;
  label: string;
  home: number; // normalized number (percents pre-multiplied to 0-100)
  away: number;
  displayHome: string;
  displayAway: string;
  /** possession-like: bar is home-share of total, capped */
  kind: 'pct' | 'count';
};

export type LineupPlayer = {
  id: number;
  name: string;
  number: number | null;
  pos: string | null;
  grid: string | null; // "1:1" → row:col for pitch placement
  captain?: boolean;
};

export type TeamLineup = {
  team: TeamRef;
  formation: string | null;
  coach: { id: number; name: string; photo: string } | null;
  starters: LineupPlayer[];
  bench: LineupPlayer[];
  colors: { playerNumber: string; playerMainColor: string; playerBorder: string } | null;
};

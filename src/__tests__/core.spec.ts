/**
 * Unit tests for GoalCreed's pure core (no react-native imports).
 * Run with: npm test   (esbuild bundles through the tsconfig paths, then node)
 */
import assert from 'node:assert/strict';
import { statusInfo, scoreSuffix, seasonStringFor } from '@/lib/time';
import {
  toUiMatch,
  sortMatches,
  groupByLeague,
  buildTimeline,
  groupTimeline,
  normalizeStats,
  parseStatValue,
  shortTeamName,
} from '@/api/normalize';
import type { Fixture, MatchEvent, TeamStatistics } from '@/api/types';

// ---- tiny runner ----------------------------------------------------------
let pass = 0;
let fail = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    pass++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    fail++;
    console.error(`  ✗ ${name}\n    ${(e as Error).message}`);
  }
}
const suite = (name: string, fn: () => void) => {
  console.log(`\n${name}`);
  fn();
};

// ---- helpers --------------------------------------------------------------
function makeFixture(over: Partial<Fixture>): Fixture {
  return {
    fixture: {
      id: 1,
      referee: null,
      timezone: 'UTC',
      date: '2026-09-24T18:00:00+00:00',
      timestamp: 1790000000,
      venue: { id: 1, name: 'Etihad Stadium', city: 'Manchester' },
      status: { long: 'Match Finished', short: 'FT', elapsed: 90, extra: null },
    },
    league: { id: 39, name: 'Premier League', country: 'England', logo: 'l.png', flag: 'f.png', season: 2026, round: 'Regular Season - 6' },
    teams: {
      home: { id: 50, name: 'Manchester City', logo: 'h.png', winner: true },
      away: { id: 42, name: 'Liverpool FC', logo: 'a.png', winner: false },
    },
    goals: { home: 2, away: 1 },
    score: { halftime: { h: 1, a: 1 }, fullTime: { h: 2, a: 1 }, extraTime: null, penalty: null },
    update: 1790003600,
    ...over,
  } as Fixture;
}

// ===========================================================================
suite('statusInfo / clock', () => {
  test('live minute becomes the chip', () => {
    const s = statusInfo('2H', 67);
    assert.equal(s.group, 'live');
    assert.equal(s.chip, "67'");
    assert.equal(s.ticking, true);
  });
  test('live with no elapsed falls back to LIVE', () => {
    assert.equal(statusInfo('1H', null).chip, 'LIVE');
  });
  test('HT is a haltime group and does not tick', () => {
    const s = statusInfo('HT', 45);
    assert.equal(s.group, 'halftime');
    assert.equal(s.chip, 'HT');
    assert.equal(s.ticking, false);
  });
  test('NS is scheduled', () => {
    assert.equal(statusInfo('NS', 0).group, 'scheduled');
  });
  test('AET and PEN count as finished', () => {
    assert.equal(statusInfo('AET', 120).group, 'finished');
    assert.equal(statusInfo('PEN', 120).group, 'finished');
  });
  test('scoreSuffix for penalties', () => {
    assert.equal(scoreSuffix('PEN', { penalty: { h: 5, a: 4 } }), 'pens 5–4');
    assert.equal(scoreSuffix('AET', { extraTime: { h: 2, a: 1 } }), 'a.e.t. 2–1');
    assert.equal(scoreSuffix('FT', {}), null);
  });
});

suite('team names', () => {
  test('strips org prefixes for shorts', () => {
    assert.equal(shortTeamName('Liverpool FC'), 'Liverpool');
    assert.equal(shortTeamName('Manchester City'), 'City'); // >11 chars → last word
    assert.equal(shortTeamName('Arsenal'), 'Arsenal');
  });
});

suite('toUiMatch', () => {
  test('maps raw fixture to UI model', () => {
    const m = toUiMatch(makeFixture({}));
    assert.equal(m.id, 1);
    assert.equal(m.goalsHome, 2);
    assert.equal(m.homeShort, 'City');
    assert.equal(m.status.group, 'finished');
    assert.equal(m.homeWinner, true);
    assert.equal(m.awayWinner, false);
    assert.equal(m.venue, 'Etihad Stadium');
  });
  test('not-started match hides scores', () => {
    const f = makeFixture({});
    f.fixture.status = { long: 'Not Started', short: 'NS', elapsed: null, extra: null };
    f.goals = { home: null, away: null };
    const m = toUiMatch(f);
    assert.equal(m.hasStarted, false);
    assert.equal(m.status.group, 'scheduled');
  });
});

suite('sorting & grouping', () => {
  test('live beats upcoming which beats finished', () => {
    const live = toUiMatch(
      (() => {
        const f = makeFixture({});
        f.fixture.id = 1;
        f.fixture.status = { long: 'Second Half', short: '2H', elapsed: 55, extra: null };
        return f;
      })()
    );
    const ns = toUiMatch(
      (() => {
        const f = makeFixture({});
        f.fixture.id = 2;
        f.fixture.status = { long: 'Not Started', short: 'NS', elapsed: null, extra: null };
        return f;
      })()
    );
    const ft = toUiMatch(makeFixture({}));
    ft.id = 3;
    const sorted = sortMatches([ft, ns, live]);
    assert.deepEqual(sorted.map((m) => m.id), [1, 2, 3]);
  });
  test('groupByLeague floats leagues with live games and sums sizes', () => {
    const a = toUiMatch(makeFixture({}));
    const b = toUiMatch(
      (() => {
        const f = makeFixture({});
        f.league = { ...f.league, name: 'Champions League' };
        f.fixture.status = { long: 'First Half', short: '1H', elapsed: 20, extra: null };
        return f;
      })()
    );
    const groups = groupByLeague([a, b]);
    assert.equal(groups.length, 2);
    assert.equal(groups[0].name, 'Champions League'); // live first
    assert.equal(groups[0].matches.length, 1);
  });
});

suite('timeline (goals, cards, subs)', () => {
  const ev = (over: Partial<MatchEvent>): MatchEvent =>
    ({
      team: { id: 50, name: 'Manchester City', logo: 'h.png' },
      player: { id: 1, name: 'E. Haaland', photo: 'p.png' },
      assist: { id: 2, name: 'K. De Bruyne', photo: '' },
      type: 'Goal',
      detail: 'Regular Goal',
      sub: null,
      elapsed: 23,
      extra: null,
      ...over,
    });

  test('classifies normal, penalty, own and missed-pen goals', () => {
    const items = buildTimeline(
      [
        ev({}),
        ev({ detail: 'Penalty', elapsed: 45, extra: 2 }),
        ev({ detail: 'Own Goal', team: { id: 42, name: 'Liverpool', logo: '' }, elapsed: 60 }),
        ev({ detail: 'Missed Penalty', elapsed: 80 }),
      ],
      50
    );
    assert.deepEqual(items.map((i) => i.kind), ['goal', 'penalty-goal', 'own-goal', 'missed-penalty']);
    assert.equal(items[0].side, 'home');
    assert.equal(items[2].side, 'away');
    assert.equal(items[1].minuteLabel, "45+2'");
    assert.equal(items[0].assist, 'K. De Bruyne');
  });

  test('cards split yellow / red / second yellow', () => {
    const items = buildTimeline(
      [
        ev({ type: 'Card', detail: 'Yellow', elapsed: 12 }),
        ev({ type: 'Card', detail: 'Red', elapsed: 30 }),
        ev({ type: 'Card', detail: 'Second Yellow', elapsed: 33 }),
      ],
      50
    );
    assert.deepEqual(items.map((i) => i.kind), ['yellow', 'red', 'yellowred']);
  });

  test('subs keep the player coming on; negative VAR is dropped', () => {
    const items = buildTimeline(
      [
        ev({ type: 'subst', detail: 'Sub', elapsed: 70, sub: { id: 9, name: 'J. Stones', photo: '' } }),
        ev({ type: 'Var', detail: 'No Goal', elapsed: 71 }),
      ],
      50
    );
    assert.equal(items.length, 1);
    assert.equal(items[0].kind, 'sub');
    assert.equal(items[0].playerOut, 'J. Stones');
  });

  test('period grouping with per-period goal tallies (own goals credit the other side)', () => {
    const items = buildTimeline(
      [
        ev({}), // 23' home regular
        ev({ detail: 'Own Goal', team: { id: 42, name: 'Liverpool', logo: '' }, elapsed: 40 }), // credits HOME side tally? own goal by away → home tally
        ev({ elapsed: 46 }),
        ev({ elapsed: 95, team: { id: 42, name: 'Liverpool', logo: '' }, detail: 'Penalty' }),
      ],
      50
    );
    const periods = groupTimeline(items);
    assert.deepEqual(periods.map((p) => p.label), ['First Half', 'Second Half', 'Extra Time']);
    assert.deepEqual([periods[0].goalsHome, periods[0].goalsAway], [2, 0]);
    assert.equal(periods[1].goalsHome, 1);
    assert.deepEqual([periods[2].goalsHome, periods[2].goalsAway], [0, 1]);
  });
});

suite('statistics', () => {
  const team = (id: number, name: string, stats: [string, string | number | null][]): TeamStatistics => ({
    team: { id, name, logo: '' },
    statistics: stats.map(([type, value]) => ({ type, value })),
  });

  test('parses % and "a / b" and skips no-statistic', () => {
    assert.equal(parseStatValue('55%'), 55);
    assert.equal(parseStatValue('267 / 338'), 267);
    assert.equal(parseStatValue('No Statistic'), null);
    assert.equal(parseStatValue(null), null);
    assert.equal(parseStatValue(12), 12);
  });

  test('normalizes and orders rows home-left', () => {
    const rows = normalizeStats(
      [
        team(50, 'Home', [
          ['Ball Possession', '62%'],
          ['Shots on Goal', '7'],
          ['Fouls', 'No Statistic'],
          ['Yellow Cards', '2'],
        ]),
        team(42, 'Away', [
          ['Ball Possession', '38%'],
          ['Shots on Goal', '4'],
          ['Yellow Cards', '1'],
        ]),
      ],
      50
    );
    assert.deepEqual(rows.map((r) => r.key), ['Ball Possession', 'Shots on Goal', 'Yellow Cards']);
    assert.equal(rows[0].displayHome, '62%');
    assert.equal(rows[0].kind, 'pct');
    assert.equal(rows[1].home, 7);
    assert.equal(rows[1].away, 4);
    assert.equal(rows[1].kind, 'count');
    assert.equal(rows[2].displayAway, '1');
  });

  test('empty payload → empty rows', () => {
    assert.deepEqual(normalizeStats([], 50), []);
  });
});

suite('season helper for sportsdb league badges', () => {
  test('august maps to y..y+1', () => {
    assert.equal(seasonStringFor('2026-08-15T18:00:00+00:00'), '2026-2027');
  });
  test('february maps to y-1..y', () => {
    assert.equal(seasonStringFor('2026-02-10T18:00:00+00:00'), '2025-2026');
  });
});

// ---- results --------------------------------------------------------------
console.log(`\n${pass} passing, ${fail} failing`);
if (fail) process.exit(1);

/**
 * TheSportsDB — powers "the other" data GoalCreed needs:
 *   • high-quality club crests (transparent badges) & league emblems
 *   • team metadata (country, founded) & fan-art backgrounds for match headers
 * Free public tier uses key "3"; the client serializes + throttles requests
 * because the free tier is rate-limited, and caches aggressively (crests
 * never expire in practice).
 */
import { requestJson } from '@/api/client';
import { getSettings } from '@/lib/settings-store';

const BASE = 'https://www.thesportsdb.com/api/v1/json';

function url(path: string) {
  return `${BASE}/${getSettings().sportsDbKey.trim() || '3'}/${path}`;
}

// ---- throttle: one sportsdb request at a time, ≥350ms apart -------------
let chain: Promise<unknown> = Promise.resolve();
let lastAt = 0;
function throttled<T>(job: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = Math.max(0, 350 - (Date.now() - lastAt));
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastAt = Date.now();
    return job();
  });
  chain = run.catch(() => {});
  return run;
}

export type SdbTeam = {
  idTeam: string;
  strTeam: string;
  strTeamBadge?: string | null; // 1024 badge
  strTeamJersey?: string | null;
  strTeamFanart1?: string | null;
  strTeamFanart2?: string | null;
  idAPIfootball?: string | null;
  strCountry?: string | null;
  intFormedYear?: string | null;
};

export type SdbLeagueBadge = { idLeague: string; strLeague: string; strBadge?: string | null };

type SearchTeamsResponse = { teams: SdbTeam[] | null };
type LeaguesResponse = { leagues: SdbLeagueBadge[] | null };

/** Team search by name (exact match first). Cached essentially forever. */
export async function searchTeam(name: string): Promise<SdbTeam | null> {
  const clean = name.trim().replace(/\s+/g, ' ');
  const json = await throttled(() =>
    requestJson<SearchTeamsResponse>(url(`searchteams.php?s=${encodeURIComponent(clean)}`), {
      cacheKey: `sdb.team.${clean.toLowerCase()}`,
      ttlMs: 30 * 86400_000,
      staleOkMs: 30 * 86400_000,
    })
  );
  const teams = json?.teams ?? null;
  if (!teams?.length) return null;
  const exact = teams.find((t) => t.strTeam.toLowerCase() === clean.toLowerCase());
  return exact ?? teams[0];
}

/**
 * League badges for a season in one call (e.g. "2024-2025").
 * The map is keyed by lowercased league name for fuzzy lookup.
 */
export async function getLeagueBadges(season: string): Promise<Map<string, string>> {
  const json = await throttled(() =>
    requestJson<LeaguesResponse>(url(`leagues.php?s=${encodeURIComponent(season)}`), {
      cacheKey: `sdb.leagues.${season}`,
      ttlMs: 24 * 3600_000,
      staleOkMs: 7 * 86400_000,
    })
  );
  const map = new Map<string, string>();
  for (const l of json?.leagues ?? []) {
    if (l.strBadge) map.set(l.strLeague.toLowerCase(), l.strBadge);
  }
  return map;
}

/** Fan-art background for a team's crest colour grade (match header mood). */
export async function getTeamFanart(name: string): Promise<string | null> {
  const t = await searchTeam(name);
  return t?.strTeamFanart2 || t?.strTeamFanart1 || null;
}

/**
 * Best-effort league name normalization so we can match API-Football
 * names against TheSportsDB ("English Premier League" vs "Premier League").
 */
export function sdbLeagueLookupName(afName: string): string {
  const n = afName.toLowerCase();
  const aliases: [RegExp, string][] = [
    [/^english premier league$/, 'Premier League'],
    [/spanish (la )?liga$|^p1 iva$/i, 'La Liga'],
    [/italian serie a$|^p1 italy$/i, 'Serie A'],
    [/german bundesliga$|^p1 germany$/i, 'Bundesliga 1'],
    [/french Ligue 1$|^p1 france$/i, 'Ligue 1'],
    [/saudi (pro )?league/i, 'Saudi League'],
    [/dutch eredivisie/i, 'Eredivisie'],
    [/portuguese liga/i, 'Liga Portugal'],
    [/uefa champions league/i, 'Champions League 2024-2025'],
    [/uefa (europa|conference)/i, 'UEFA Europa League'],
  ];
  for (const [re, mapped] of aliases) if (re.test(n)) return mapped;
  return afName.replace(/^(english|spanish|italian|german|french)\s+/i, '');
}

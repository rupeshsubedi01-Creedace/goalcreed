/**
 * API-Football v3 (api-sports.io) — powers LIVE scores, fixtures,
 * statistics and the goal timeline. Free "individual" plan: 100 req/day,
 * so every call here goes through the cached client and uses sane TTLs.
 *
 * Endpoints used (per the repository/API spec):
 *   GET /fixtures?live=all                → live scoreboards (precise minute)
 *   GET /fixtures?date=YYYY-MM-DD[&league=] → fixtures by day
 *   GET /fixtures?ids=ID                  → single fixture refresh
 *   GET /fixtures/events?fixture=ID        → goal & card timeline
 *   GET /fixtures/statistics?fixture=ID    → detailed match stats
 *   GET /fixtures/lineups?fixture=ID       → lineups & formations
 *   GET /status                            → key health check (Settings)
 */
import { ApiError, apiFootballBase, requestJson } from '@/api/client';
import { getSettings } from '@/lib/settings-store';
import type { Fixture, MatchEvent, TeamStatistics, TeamLineup } from '@/api/types';

type Wrapped<T> = { response: T[]; paging?: { current: number; total: number } };

async function af<T>(path: string, params: Record<string, string | number>, cacheKey: string, ttlMs: number): Promise<T[]> {
  const key = getSettings().apiFootballKey.trim();
  if (!key) {
    throw new ApiError(
      'API-Football key is not set. Open Settings → Data source and paste your free key from dashboard.api-football.com.',
      'key'
    );
  }
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  const url = `${apiFootballBase()}${path}?${qs.toString()}`;
  const json = await requestJson<Wrapped<T>>(url, {
    headers: { 'x-apisports-key': key },
    cacheKey,
    ttlMs,
    staleOkMs: 24 * 3600_000,
  });
  return json?.response ?? [];
}

/** LIVE matches everywhere — the app's beating heart. */
export function getLiveFixtures() {
  return af<Fixture>('/fixtures', { live: 'all' }, 'af.live', 12_000);
}

/** Fixtures for one day, optionally filtered to a league. */
export function getFixturesByDate(date: string, leagueIds?: number[]) {
  const params: Record<string, string | number> = { date };
  if (leagueIds?.length) params.league = leagueIds.join('-');
  return af<Fixture>('/fixtures', params, `af.day.${date}.${leagueIds?.join('-') ?? 'all'}`, 120_000);
}

export function getFixtureById(id: number) {
  return af<Fixture>('/fixtures', { id }, `af.fix.${id}`, 20_000);
}

export function getFixtureEvents(id: number) {
  return af<MatchEvent>('/fixtures/events', { fixture: id }, `af.events.${id}`, 30_000);
}

export function getFixtureStats(id: number) {
  return af<TeamStatistics>('/fixtures/statistics', { fixture: id }, `af.stats.${id}`, 30_000);
}

export function getFixtureLineups(id: number) {
  return af<TeamLineup>('/fixtures/lineups', { fixture: id }, `af.lineups.${id}`, 10 * 60_000);
}

/** Quick plan/key health check used by the Settings screen. */
export async function pingStatus(): Promise<{ calls: number | null; message: string }> {
  const key = getSettings().apiFootballKey.trim();
  if (!key) throw new ApiError('No key set yet.', 'key');
  const url = `${apiFootballBase()}/status`;
  const json = await requestJson<{ response: { account: { calls: { today?: { total: number } } } } }>(
    url,
    { headers: { 'x-apisports-key': key } }
  );
  const calls = json?.response?.account?.calls?.today?.total ?? null;
  return { calls, message: 'Key is live — plan verified.' };
}

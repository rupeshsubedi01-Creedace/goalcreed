/**
 * GoalCreed HTTP client: one funnel for every network call so we can
 *   1) persist a tiny cache (API-Football free tier = 100 req/day — we must
 *      not burn it re-fetching what we just fetched),
 *   2) count requests per UTC day and surface the budget in Settings,
 *   3) translate API-Football's {errors:{...}} payload into friendly UI errors.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSettings } from '@/lib/settings-store';

const memCache = new Map<string, { at: number; data: unknown }>();
const CACHE_PREFIX = 'goalcreed.cache.';
const BUDGET_PREFIX = 'goalcreed.budget.';

export class ApiError extends Error {
  constructor(message: string, public kind: 'network' | 'quota' | 'key' | 'api' | 'empty' = 'api') {
    super(message);
    this.name = 'ApiError';
  }
}

function todayKey() {
  return BUDGET_PREFIX + new Date().toISOString().slice(0, 10);
}

let dayCount = -1;
let dayCountDate = '';

export async function bumpRequestCount() {
  const key = todayKey();
  if (key !== dayCountDate) {
    dayCountDate = key;
    const raw = await AsyncStorage.getItem(key).catch(() => null);
    dayCount = raw ? parseInt(raw, 10) || 0 : 0;
  }
  dayCount += 1;
  AsyncStorage.setItem(key, String(dayCount)).catch(() => {});
  return dayCount;
}

export function peekRequestCount(): number {
  return dayCount < 0 ? 0 : dayCount;
}

export function getTodayCount(): number {
  return dayCountDate === todayKey() ? Math.max(0, dayCount) : 0;
}

async function readPersisted(key: string): Promise<{ at: number; data: unknown } | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writePersisted(key: string, entry: { at: number; data: unknown }) {
  try {
    AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry)).catch(() => {});
  } catch {
    /* storage full — non-fatal */
  }
}

/** Evict stale entries (called at app start; keeps storage lean). */
export async function pruneCache(maxAgeMs = 7 * 86400000) {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(CACHE_PREFIX));
    const now = Date.now();
    const doomed: string[] = [];
    for (const k of keys) {
      const raw = await AsyncStorage.getItem(k);
      if (!raw) continue;
      try {
        const e = JSON.parse(raw) as { at: number };
        if (now - e.at > maxAgeMs) doomed.push(k);
      } catch {
        doomed.push(k);
      }
    }
    if (doomed.length) await AsyncStorage.multiRemove(doomed);
  } catch {
    /* non-fatal */
  }
}

export type RequestOptions = {
  /** stable cache identity; omit to bypass cache entirely */
  cacheKey?: string;
  /** fresh-for window in ms (network still allowed after it expires) */
  ttlMs?: number;
  /** hard ceiling for stale data — when network fails, serve it anyway */
  staleOkMs?: number;
  headers?: Record<string, string>;
  method?: 'GET' | 'POST';
  body?: string;
};

/**
 * Fetch JSON with layered cache (memory → AsyncStorage → network).
 * Returns `{ data, fromCache, fetchedAt }` so UI can show "updated Ns ago".
 */
export async function requestJson<T>(url: string, opts: RequestOptions = {}): Promise<T> {
  const { cacheKey, ttlMs = 0, staleOkMs = 0 } = opts;
  const now = Date.now();

  if (cacheKey) {
    const mem = memCache.get(cacheKey);
    if (mem && now - mem.at <= ttlMs) return mem.data as T;
    const disk = await readPersisted(cacheKey);
    if (disk) {
      memCache.set(cacheKey, disk);
      if (now - disk.at <= ttlMs) return disk.data as T;
    }
  }

  let res: Response;
  try {
    await bumpRequestCount();
    res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: { Accept: 'application/json', ...opts.headers },
      body: opts.body,
    });
  } catch {
    // network hiccup: serve stale if we have it
    if (cacheKey) {
      const stale = memCache.get(cacheKey) ?? (await readPersisted(cacheKey));
      if (stale && staleOkMs > 0 && now - stale.at <= staleOkMs) return stale.data as T;
    }
    throw new ApiError('No connection. Showing cached data where possible.', 'network');
  }

  const payload = await res.json().catch(() => null);
  if (!res.ok && !payload) {
    if (res.status === 429) throw new ApiError('API rate limit hit — wait a minute and retry.', 'quota');
    throw new ApiError(`Request failed (${res.status})`, 'api');
  }

  // API-Football returns HTTP 200 with an `errors` object when the key is bad/over quota
  if (payload && typeof payload === 'object' && 'errors' in payload) {
    const errs = (payload as { errors: Record<string, unknown> }).errors;
    const msg = errs && Object.keys(errs).length ? String(Object.values(errs)[0]) : null;
    if (msg) {
      const kind = /days|requests|quota/i.test(msg)
        ? 'quota'
        : /key|token/i.test(msg)
          ? 'key'
          : 'api';
      throw new ApiError(msg, kind as ApiError['kind']);
    }
  }

  const data = (payload ?? null) as T;
  if (cacheKey && data) {
    const entry = { at: Date.now(), data };
    memCache.set(cacheKey, entry);
    writePersisted(cacheKey, entry);
  }
  return data;
}

export function clearMemCache() {
  memCache.clear();
}

export async function clearAllCache() {
  clearMemCache();
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(CACHE_PREFIX));
  if (keys.length) await AsyncStorage.multiRemove(keys);
}

export function apiFootballBase() {
  return 'https://v3.football.api-sports.io';
}

export function getSettingsForClient() {
  return getSettings();
}

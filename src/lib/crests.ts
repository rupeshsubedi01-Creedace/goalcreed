/**
 * Crest resolution — "high-quality club logos" pipeline:
 *   1. TheSportsDB transparent badge (lookup by name, permanently cached)
 *   2. API-Football's own team logo (always present)
 *   3. initials monogram (offline)
 * League emblems follow the same idea with TheSportsDB season badges.
 * Lookups are fire-and-forget and deduped per session so we never spam
 * the sportsdb free tier.
 */
import { useEffect, useState } from 'react';
import { searchTeam, getLeagueBadges, sdbLeagueLookupName } from '@/api/sportsdb';
import { seasonStringFor } from '@/lib/time';

const badgeByTeam = new Map<string, string | null>(); // lowercased name → url (null = looked up, missing)
const inflight = new Map<string, Promise<SdbResult>>();
type SdbResult = { badge: string | null };

function lookupTeam(name: string): Promise<SdbResult> {
  const key = name.trim().toLowerCase();
  if (badgeByTeam.has(key)) return Promise.resolve({ badge: badgeByTeam.get(key)! });
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = searchTeam(name)
    .then((t) => {
      const badge = t?.strTeamBadge || null;
      badgeByTeam.set(key, badge);
      return { badge };
    })
    .catch(() => ({ badge: null as string | null }))
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export function useTeamCrest(teamName: string, fallbackLogo: string): { uri: string | null; state: 'crest' | 'fallback' | 'none' } {
  const [uri, setUri] = useState<string | null>(() => badgeByTeam.get(teamName.trim().toLowerCase()) ?? null);
  const [state, setState] = useState<'crest' | 'fallback' | 'none'>(() => (uri ? 'crest' : fallbackLogo ? 'fallback' : 'none'));

  useEffect(() => {
    let alive = true;
    if (badgeByTeam.has(teamName.trim().toLowerCase())) {
      const b = badgeByTeam.get(teamName.trim().toLowerCase())!;
      setUri(b);
      setState(b ? 'crest' : fallbackLogo ? 'fallback' : 'none');
      return;
    }
    setState(fallbackLogo ? 'fallback' : 'none'); // show fallback immediately, upgrade when crest lands
    lookupTeam(teamName).then((r) => {
      if (!alive) return;
      if (r.badge) {
        setUri(r.badge);
        setState('crest');
      }
    });
    return () => {
      alive = false;
    };
  }, [teamName, fallbackLogo]);

  if (state === 'crest' && uri) return { uri, state };
  if (fallbackLogo) return { uri: fallbackLogo, state: 'fallback' };
  return { uri: null, state: 'none' };
}

// ---- league emblems -------------------------------------------------------

let leagueMap: Map<string, string> | null = null;
let leaguePromise: Promise<void> | null = null;
const leagueNameCache = new Map<string, string | null>();

/** Re-exported from the pure time module so UI code has one import site. */
export { seasonStringFor } from '@/lib/time';

export function useLeagueCrest(leagueName: string, fallbackLogo: string, kickoffIso: string): string | null {
  const [uri, setUri] = useState<string | null>(() => leagueNameCache.get(leagueName) ?? null);
  useEffect(() => {
    if (leagueNameCache.has(leagueName)) {
      setUri(leagueNameCache.get(leagueName)!);
      return;
    }
    if (!leaguePromise) {
      leaguePromise = getLeagueBadges(seasonStringFor(kickoffIso))
        .then((m) => {
          leagueMap = m;
        })
        .catch(() => {
          leagueMap = new Map();
        });
    }
    let alive = true;
    leaguePromise.then(() => {
      if (!alive || !leagueMap) return;
      const wanted = sdbLeagueLookupName(leagueName).toLowerCase();
      let hit = leagueMap.get(wanted) ?? leagueMap.get(leagueName.toLowerCase()) ?? null;
      if (!hit) {
        for (const [name, badge] of leagueMap) {
          if (name.includes(wanted) || wanted.includes(name)) {
            hit = badge;
            break;
          }
        }
      }
      leagueNameCache.set(leagueName, hit);
      setUri(hit);
    });
    return () => {
      alive = false;
    };
  }, [leagueName, kickoffIso]);
  return uri ?? fallbackLogo ?? null;
}

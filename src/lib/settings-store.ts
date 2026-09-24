/**
 * Settings storage — framework-free core (importable from tests and the
 * React context). Values persist in AsyncStorage; env vars provide the
 * CI-friendly defaults:
 *   EXPO_PUBLIC_API_FOOTBALL_KEY   (recommended: set in EAS/CodeSandbox env)
 *   EXPO_PUBLIC_SPORTSDB_KEY       (default "3" = the public demo key)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setHapticsEnabled } from '@/lib/haptics';

const KEY = 'goalcreed.settings.v1';

export type GoalCreedSettings = {
  apiFootballKey: string;
  sportsDbKey: string;
  /** live poll interval in seconds */
  pollSec: number;
  hapticsOn: boolean;
};

export const DEFAULT_SETTINGS: GoalCreedSettings = {
  apiFootballKey: (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_FOOTBALL_KEY) || '',
  sportsDbKey: (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SPORTSDB_KEY) || '3',
  pollSec: 60,
  hapticsOn: true,
};

// live mirror so the api layer can read synchronously without context plumbing
let live: GoalCreedSettings = { ...DEFAULT_SETTINGS };

export function getSettings(): GoalCreedSettings {
  return live;
}

export async function loadSettings(): Promise<GoalCreedSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GoalCreedSettings>;
      live = { ...DEFAULT_SETTINGS, ...parsed };
      // env key wins over an empty stored key (useful in cloud editors)
      if (!live.apiFootballKey && DEFAULT_SETTINGS.apiFootballKey) {
        live.apiFootballKey = DEFAULT_SETTINGS.apiFootballKey;
      }
    }
  } catch {
    live = { ...DEFAULT_SETTINGS };
  }
  setHapticsEnabled(live.hapticsOn);
  return live;
}

export async function saveSettings(patch: Partial<GoalCreedSettings>): Promise<GoalCreedSettings> {
  live = { ...live, ...patch };
  setHapticsEnabled(live.hapticsOn);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(live));
  } catch {
    /* non-fatal */
  }
  return live;
}

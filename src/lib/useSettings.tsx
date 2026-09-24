/**
 * React binding for the settings store: hydrates AsyncStorage at boot,
 * exposes a reactive snapshot + a save() that also invalidates queries
 * (so a new API key takes effect immediately).
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type GoalCreedSettings } from '@/lib/settings-store';

type Ctx = {
  settings: GoalCreedSettings;
  ready: boolean;
  update: (patch: Partial<GoalCreedSettings>) => Promise<void>;
};

const SettingsContext = createContext<Ctx>({ settings: DEFAULT_SETTINGS, ready: false, update: async () => {} });

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<GoalCreedSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      setReady(true);
    });
  }, []);

  const update = useCallback(
    async (patch: Partial<GoalCreedSettings>) => {
      const next = await saveSettings(patch);
      setSettings({ ...next });
      if (patch.apiFootballKey !== undefined || patch.sportsDbKey !== undefined) {
        qc.invalidateQueries();
      }
    },
    [qc]
  );

  return <SettingsContext.Provider value={{ settings, ready, update }}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}

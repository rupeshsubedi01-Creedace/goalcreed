import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SettingsProvider, useSettings } from '@/lib/useSettings';
import { pruneCache } from '@/api/client';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 10_000,
    },
  },
});

function BootGate({ children }: { children: React.ReactNode }) {
  const { ready } = useSettings();
  useEffect(() => {
    pruneCache(); // hygiene: drop >7-day stale cache entries at launch
  }, []);
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  if (!ready) return null;
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <QueryClientProvider client={queryClient}>
        <SettingsProvider>
          <BootGate>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg },
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="match/[id]" options={{ animation: 'slide_from_bottom' }} />
            </Stack>
          </BootGate>
        </SettingsProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

/**
 * LIVE — the home tab. Real-time scoreboards with precise locally-ticked
 * clocks, poll refresh on a budget-aware cadence, pull-to-refresh, and
 * goal flashes (haptic + green glow) the instant a score moves.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Header, LiveMeta } from '@/components/Header';
import { MatchCard } from '@/components/MatchCard';
import { PressableScale } from '@/components/PressableScale';
import { colors, font, radius, spacing } from '@/theme';
import { getLiveFixtures } from '@/api/apifootball';
import { sortMatches, toUiMatch, type UiMatch } from '@/api/normalize';
import { useGoalWatch } from '@/lib/useGoalWatch';
import { useSettings } from '@/lib/useSettings';
import * as haptics from '@/lib/haptics';
import { ApiError } from '@/api/client';

function useAgoLabel(ts: number | undefined) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);
  if (!ts) return '—';
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

export default function LiveScreen() {
  const { settings, ready } = useSettings();
  const hasKey = !!settings.apiFootballKey.trim();

  const query = useQuery({
    queryKey: ['live'],
    queryFn: async () => sortMatches((await getLiveFixtures()).map(toUiMatch)),
    enabled: ready && hasKey,
    refetchInterval: settings.pollSec * 1000,
    staleTime: 8000,
  });

  const matches: UiMatch[] = query.data ?? [];
  const flashing = useGoalWatch(matches, ready && hasKey);
  const ago = useAgoLabel(query.dataUpdatedAt);

  const onRefresh = useCallback(() => {
    haptics.soft();
    query.refetch().then((r) => {
      if (!r.error) haptics.success();
    });
  }, [query]);

  const openMatch = useCallback((id: number) => {
    haptics.tap();
    router.push({ pathname: '/match/[id]', params: { id: String(id) } });
  }, []);

  const totalGoals = useMemo(() => matches.reduce((acc, m) => acc + m.goalsHome + m.goalsAway, 0), [matches]);

  const listEmpty = useMemo(() => {
    if (!hasKey) return <NoKeyNotice />;
    if (query.isLoading) return <LoadingNotice />;
    if (query.error) return <ErrorNotice error={query.error} retry={() => query.refetch()} />;
    return <NoLiveNotice onBrowse={() => { haptics.tick(); router.push('/fixtures'); }} />;
  }, [hasKey, query.isLoading, query.error, query]);

  return (
    <View style={styles.screen}>
      <Header
        title="Live"
        meta={
          <LiveMeta accent={matches.length > 0}>
            {hasKey ? (
              matches.length ? (
                <Text style={styles.metaText}>
                  <Text style={{ color: colors.live }}>● </Text>
                  {matches.length} in play · {totalGoals} goal{totalGoals === 1 ? '' : 's'} · {ago}
                </Text>
              ) : (
                <Text style={styles.metaText}>Quiet in the stadiums · checking every {settings.pollSec}s</Text>
              )
            ) : (
              <Text style={styles.metaText}>Connect your free API key to go live</Text>
            )}
          </LiveMeta>
        }
        right={
          <PressableScale feel="soft" radiusPx={radius.md} style={styles.refreshBtn} onPress={onRefresh} disabled={query.isFetching}>
            {query.isFetching ? (
              <ActivityIndicator size="small" color={colors.blue} />
            ) : (
              <Ionicons name="refresh" size={18} color={colors.textDim} />
            )}
          </PressableScale>
        }
      />
      <FlatList
        data={matches}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: 100 }}
        renderItem={({ item }) => <MatchCard match={item} onPress={openMatch} flash={flashing.has(item.id)} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching && !query.isPlaceholderData}
            onRefresh={onRefresh}
            tintColor={colors.pitch}
            colors={[colors.pitch]}
            progressBackgroundColor={colors.bgElevated}
          />
        }
        ListEmptyComponent={listEmpty}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function Shell(props: { children: React.ReactNode }) {
  return (
    <View style={styles.notice}>
      <View style={styles.noticeCard}>
        <View style={styles.noticeIcon}>{props.children}</View>
      </View>
    </View>
  );
}

function NoKeyNotice() {
  return (
    <Shell>
      <Ionicons name="key-outline" size={30} color={colors.amber} />
      <Text style={styles.noticeTitle}>Bring your own (free) key</Text>
      <Text style={styles.noticeBody}>
        GoalCreed streams live scores from API-Football. Grab a free key at dashboard.api-football.com
        (100 requests/day) and paste it in Settings.
      </Text>
      <PressableScale
        feel="firm"
        radiusPx={radius.pill}
        style={styles.noticeBtn}
        onPress={() => {
          haptics.tap();
          router.push('/settings');
        }}
      >
        <Text style={styles.noticeBtnText}>Open Settings</Text>
      </PressableScale>
    </Shell>
  );
}

function NoLiveNotice({ onBrowse }: { onBrowse: () => void }) {
  return (
    <Shell>
      <Ionicons name="moon-outline" size={30} color={colors.blue} />
      <Text style={styles.noticeTitle}>Nothing on the pitch right now</Text>
      <Text style={styles.noticeBody}>No matches are live at this minute. Football sleeps so highlights can happen.</Text>
      <PressableScale feel="firm" radiusPx={radius.pill} style={styles.noticeBtn} onPress={onBrowse}>
        <Text style={styles.noticeBtnText}>Browse today&apos;s fixtures</Text>
      </PressableScale>
    </Shell>
  );
}

function LoadingNotice() {
  return (
    <Shell>
      <ActivityIndicator size="large" color={colors.pitch} />
      <Text style={styles.noticeBody}>Whistling up the live feed…</Text>
    </Shell>
  );
}

function ErrorNotice({ error, retry }: { error: unknown; retry: () => void }) {
  const friendly =
    error instanceof ApiError ? error.message : 'Something went wrong reaching the live feed.';
  return (
    <Shell>
      <Ionicons name="cloud-offline-outline" size={30} color={colors.danger} />
      <Text style={styles.noticeTitle}>Feed interrupted</Text>
      <Text style={styles.noticeBody}>{friendly}</Text>
      <PressableScale
        feel="firm"
        radiusPx={radius.pill}
        style={styles.noticeBtn}
        onPress={() => {
          haptics.tap();
          retry();
        }}
      >
        <Text style={styles.noticeBtnText}>Try again</Text>
      </PressableScale>
    </Shell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  metaText: { color: colors.textDim, fontSize: font.small, fontWeight: '600' },
  refreshBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderColor: colors.stroke,
  },
  notice: { alignItems: 'center', paddingTop: spacing.xxl },
  noticeCard: {
    alignItems: 'center',
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke,
    padding: spacing.xl,
  },
  noticeIcon: { alignItems: 'center', gap: spacing.md },
  noticeTitle: { color: colors.text, fontSize: font.h2, fontWeight: '800', textAlign: 'center' },
  noticeBody: { color: colors.textDim, fontSize: font.body, textAlign: 'center', lineHeight: 20, maxWidth: 320 },
  noticeBtn: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 3,
    backgroundColor: colors.pitchDim,
    borderColor: colors.pitch + '55',
  },
  noticeBtnText: { color: colors.pitch, fontWeight: '800', fontSize: font.body },
});

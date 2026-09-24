/**
 * FIXTURES — day browser. A horizontally scrolling date strip (today
 * centred, ±7 days) feeds a league-grouped SectionList. Selecting a date
 * detents with a haptic tick; chips use the press-scale primitive.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '@/components/Header';
import { MatchCard } from '@/components/MatchCard';
import { PressableScale } from '@/components/PressableScale';
import { TeamLogo } from '@/components/TeamLogo';
import { colors, font, radius, spacing } from '@/theme';
import { getFixturesByDate } from '@/api/apifootball';
import { groupByLeague, sortMatches, toUiMatch, type LeagueGroup } from '@/api/normalize';
import { daysAround, friendlyDay, toApiDate, fromApiDate } from '@/lib/time';
import { useSettings } from '@/lib/useSettings';
import { ApiError } from '@/api/client';
import * as haptics from '@/lib/haptics';

const CHIP_W = 62;
const CHIP_GAP = 6;

export default function FixturesScreen() {
  const { settings, ready } = useSettings();
  const hasKey = !!settings.apiFootballKey.trim();
  const [selected, setSelected] = useState<Date>(() => new Date());
  const stripRef = useRef<ScrollView>(null);
  const { width: winW } = useWindowDimensions();

  const days = useMemo(() => daysAround(new Date(), 7, 7), []);
  const selectedIdx = days.findIndex(
    (d) => d.getFullYear() === selected.getFullYear() && d.getMonth() === selected.getMonth() && d.getDate() === selected.getDate()
  );

  // center the strip on the selected chip (today at first mount)
  const scrollToDay = useCallback(
    (idx: number, animated = true) => {
      const x = Math.max(0, idx * (CHIP_W + CHIP_GAP) - (winW - CHIP_W) / 2 + spacing.lg);
      stripRef.current?.scrollTo({ x, animated });
    },
    [winW]
  );
  useEffect(() => {
    if (selectedIdx >= 0) scrollToDay(selectedIdx, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dateStr = toApiDate(selected);
  const todayStr = toApiDate(new Date());
  const hasSelectedToday = dateStr === todayStr;
  const query = useQuery({
    queryKey: ['day', dateStr],
    queryFn: async () => groupByLeague(sortMatches((await getFixturesByDate(dateStr)).map(toUiMatch))),
    enabled: ready && hasKey,
    staleTime: 60_000,
    refetchInterval: hasSelectedToday ? settings.pollSec * 1000 : false,
  });

  const pick = (d: Date) => {
    haptics.tick();
    setSelected(d);
  };

  const openMatch = useCallback((id: number) => {
    router.push({ pathname: '/match/[id]', params: { id: String(id) } });
  }, []);

  const sections = query.data ?? [];
  const total = sections.reduce((n: number, g: LeagueGroup) => n + g.matches.length, 0);

  return (
    <View style={styles.screen}>
      <Header
        title="Fixtures"
        meta={
          <Text style={styles.meta}>
            {!hasKey
              ? 'Add your API key in Settings'
              : query.isLoading
                ? 'Loading the matchday…'
                : `${total} match${total === 1 ? '' : 'es'} across ${sections.length} competition${sections.length === 1 ? '' : 's'}`}
          </Text>
        }
      />

      <View style={styles.stripWrap}>
        <ScrollView
          ref={stripRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: CHIP_GAP }}
        >
          {days.map((d, i) => {
            const isSel = i === selectedIdx;
            const isToday = toApiDate(d) === toApiDate(new Date());
            return (
              <PressableScale
                key={i}
                feel="tick"
                radiusPx={radius.md}
                style={[styles.dayChip, isSel && styles.dayChipSel]}
                onPress={() => pick(d)}
              >
                <Text style={[styles.dayName, isSel && styles.dayNameSel]}>
                  {isToday ? 'Today' : friendlyDay(d).slice(0, 3)}
                </Text>
                <Text style={[styles.dayNum, isSel && styles.dayNameSel]}>{d.getDate()}</Text>
              </PressableScale>
            );
          })}
        </ScrollView>
      </View>

      {!hasKey ? (
        <View style={styles.noticeWrap}>
          <Text style={styles.meta}>Settings → Data source → paste your API-Football key.</Text>
        </View>
      ) : query.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.pitch} size="large" />
        </View>
      ) : query.error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={28} color={colors.danger} />
          <Text style={styles.meta}>{query.error instanceof ApiError ? query.error.message : 'Feed unavailable.'}</Text>
        </View>
      ) : total === 0 ? (
        <View style={styles.center}>
          <Ionicons name="calendar-clear-outline" size={28} color={colors.textFaint} />
          <Text style={styles.meta}>No fixtures scheduled for {friendlyDay(fromApiDate(dateStr))}.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections.map((g) => ({ ...g, data: g.matches }))}
          keyExtractor={(m) => String(m.id)}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => {
                haptics.soft();
                query.refetch();
              }}
              tintColor={colors.pitch}
              colors={[colors.pitch]}
              progressBackgroundColor={colors.bgElevated}
            />
          }
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: 110 }}
          renderSectionHeader={({ section }) => (
            <View style={styles.leagueHead}>
              <TeamLogo name={section.name} fallbackLogo={section.logo} size={22} />
              <Text style={styles.leagueName} numberOfLines={1}>
                {section.name}
              </Text>
              <Text style={styles.leagueCount}>{section.matches.length}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={{ marginBottom: spacing.md }}>
              <MatchCard match={item} onPress={openMatch} />
            </View>
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  meta: { color: colors.textDim, fontSize: font.small, fontWeight: '600' },
  stripWrap: { paddingVertical: spacing.sm },
  dayChip: {
    width: CHIP_W,
    paddingVertical: 7,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderColor: colors.stroke,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dayChipSel: { backgroundColor: colors.pitchDim, borderColor: colors.pitch + '66' },
  dayName: { color: colors.textFaint, fontSize: font.tiny + 1, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  dayNum: { color: colors.text, fontSize: font.h2, fontWeight: '900', marginTop: 1, fontVariant: ['tabular-nums'] },
  dayNameSel: { color: colors.pitch },
  center: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xxl * 2, paddingHorizontal: spacing.xl },
  leagueHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.sm, paddingHorizontal: 2 },
  leagueName: { color: colors.textDim, fontSize: font.small, fontWeight: '800', letterSpacing: 0.4, flex: 1, textTransform: 'uppercase' },
  leagueCount: { color: colors.textFaint, fontSize: font.tiny + 1, fontWeight: '700', backgroundColor: colors.strokeSoft, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill },
  noticeWrap: { padding: spacing.xl, alignItems: 'center' },
});

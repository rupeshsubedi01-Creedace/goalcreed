/**
 * MATCH DETAIL — live scoreboard hero with a ticking clock, then a
 * sliding segmented control over three feeds:
 *   Timeline (goals/cards/subs by period) · Stats (mirrored bars) · Lineups
 * Data is seeded instantly from whichever list the fan tapped (zero-spin),
 * then freshened through API-Football; live matches re-poll on the
 * cadence from Settings.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions, ActivityIndicator } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '@/components/PressableScale';
import { TeamLogo } from '@/components/TeamLogo';
import { StatusChip } from '@/components/StatusChip';
import { cleanRound } from '@/components/MatchCard';
import { StatBar } from '@/components/StatBar';
import { TimelineFeed } from '@/components/TimelineFeed';
import { colors, font, motion, radius, spacing } from '@/theme';
import { getFixtureById, getFixtureEvents, getFixtureStats, getFixtureLineups } from '@/api/apifootball';
import {
  toUiMatch,
  buildTimeline,
  groupTimeline,
  normalizeStats,
  toUiLineups,
  type UiMatch,
  type LeagueGroup,
} from '@/api/normalize';
import { useTickingClock } from '@/lib/useTickingClock';
import { kickoffLabel } from '@/lib/time';
import { useSettings } from '@/lib/useSettings';
import * as haptics from '@/lib/haptics';

type Tab = 0 | 1 | 2;
const TAB_LABELS = ['Timeline', 'Stats', 'Lineups'] as const;

export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const fixtureId = Number(id);
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { settings } = useSettings();
  const [tab, setTab] = useState<Tab>(0);

  const seed = useMemo<UiMatch | undefined>(() => {
    const live = qc.getQueryData<UiMatch[]>(['live']);
    const fromLive = live?.find((m) => m.id === fixtureId);
    if (fromLive) return fromLive;
    const dayCache = qc.getQueriesData<LeagueGroup[]>({ queryKey: ['day'] });
    for (const [, groups] of dayCache) {
      if (!Array.isArray(groups)) continue;
      for (const g of groups) {
        const hit = g.matches?.find((m) => m.id === fixtureId);
        if (hit) return hit;
      }
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixtureId]);

  const fixtureQ = useQuery({
    queryKey: ['fixture', fixtureId],
    queryFn: async () => toUiMatch((await getFixtureById(fixtureId))[0]),
    placeholderData: seed,
    enabled: Number.isFinite(fixtureId),
    refetchInterval: ({ state }) => {
      const m = state.data as UiMatch | undefined;
      return m && (m.status.group === 'live' || m.status.group === 'halftime') ? settings.pollSec * 1000 : false;
    },
    staleTime: 15_000,
  });
  const match = (fixtureQ.data ?? seed) as UiMatch | undefined;

  // Goal alert on this screen: fire the signature haptic + hero flash when
  // the score moves while we're watching (never on cold load).
  const scoreSigRef = React.useRef<string | null>(null);
  const [justScored, setJustScored] = useState(false);
  useEffect(() => {
    if (!match) return;
    const sig = `${match.goalsHome}-${match.goalsAway}`;
    const prev = scoreSigRef.current;
    scoreSigRef.current = sig;
    if (prev === null || prev === sig) return;
    haptics.goal();
    setJustScored(true);
    const t = setTimeout(() => setJustScored(false), 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.goalsHome, match?.goalsAway]);

  const livePoll = settings.pollSec * 1000;
  const eventsQ = useQuery({
    queryKey: ['events', fixtureId],
    queryFn: () => getFixtureEvents(fixtureId),
    enabled: !!match,
    refetchInterval: match && (match.status.group === 'live' || match.status.group === 'halftime') ? livePoll : false,
    staleTime: 20_000,
  });
  const statsQ = useQuery({
    queryKey: ['stats', fixtureId],
    queryFn: () => getFixtureStats(fixtureId),
    enabled: !!match && match.hasStarted,
    staleTime: 30_000,
  });
  const lineupsQ = useQuery({
    queryKey: ['lineups', fixtureId],
    queryFn: () => getFixtureLineups(fixtureId),
    enabled: !!match && tab === 2,
    staleTime: 10 * 60_000,
  });

  const timeline = useMemo(
    () => (eventsQ.data && match ? groupTimeline(buildTimeline(eventsQ.data, match.homeId)) : []),
    [eventsQ.data, match]
  );
  const statRows = useMemo(
    () => (statsQ.data && match ? normalizeStats(statsQ.data, match.homeId) : []),
    [statsQ.data, match]
  );
  const lineups = useMemo(
    () => (lineupsQ.data && match ? toUiLineups(lineupsQ.data, match.homeId) : []),
    [lineupsQ.data, match]
  );

  if (!match) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Stack.Screen options={{ headerShown: false }} />
        {fixtureQ.isError ? (
          <Text style={styles.errText}>{(fixtureQ.error as Error)?.message ?? 'Match unavailable.'}</Text>
        ) : (
          <ActivityIndicator color={colors.pitch} size="large" />
        )}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* top bar */}
        <View style={styles.topBar}>
          <PressableScale
            feel="soft"
            radiusPx={radius.md}
            style={styles.iconBtn}
            onPress={() => {
              haptics.soft();
              router.back();
            }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </PressableScale>
          <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Image source={{ uri: match.leagueLogo }} style={{ width: 15, height: 15 }} contentFit="contain" />
              <Text style={styles.leagueTop} numberOfLines={1}>
                {match.leagueName}
              </Text>
            </View>
            {match.leagueRound ? <Text style={styles.roundTop}>{cleanRound(match.leagueRound)}</Text> : null}
          </View>
          <PressableScale
            feel="soft"
            radiusPx={radius.md}
            style={styles.iconBtn}
            onPress={() => {
              haptics.soft();
              fixtureQ.refetch();
              eventsQ.refetch();
              statsQ.refetch();
            }}
          >
            <Ionicons name="refresh" size={17} color={colors.textDim} />
          </PressableScale>
        </View>

        {/* hero scoreboard */}
        <View style={[styles.hero, justScored ? styles.heroScored : null]}>
          <ScoreSide
            side={match.homeName}
            logo={match.homeLogo}
            goals={match.hasStarted ? match.goalsHome : null}
            win={match.status.group === 'finished' ? match.homeWinner : match.goalsHome > match.goalsAway && match.hasStarted}
          />
          <View style={styles.centerCol}>
            {justScored ? (
              <Text style={styles.goalFlash}>⚽ GOAL!</Text>
            ) : (
              <StatusChip status={match.status} />
            )}
            <MatchClock match={match} />
            <Text style={styles.heroScore}>
              {match.hasStarted ? `${match.goalsHome}` : '–'}
              <Text style={styles.heroDash}> – </Text>
              {match.hasStarted ? `${match.goalsAway}` : '–'}
            </Text>
            {match.suffix ? <Text style={styles.suffix}>{match.suffix}</Text> : null}
            {!match.hasStarted ? <Text style={styles.kickoffBig}>{kickoffLabel(match.kickoff)}</Text> : null}
          </View>
          <ScoreSide
            side={match.awayName}
            logo={match.awayLogo}
            goals={match.hasStarted ? match.goalsAway : null}
            win={match.status.group === 'finished' ? match.awayWinner : match.goalsAway > match.goalsHome && match.hasStarted}
            right
          />
        </View>

        <View style={styles.metaRow}>
          {match.venue ? <Meta icon="business-outline" text={match.venue} /> : null}
          {match.referee ? <Meta icon="person-outline" text={`Ref · ${match.referee}`} /> : null}
          <Meta icon="time-outline" text={kickoffLabel(match.kickoff)} />
        </View>

        {/* segmented control */}
        <Segmented tab={tab} onPick={(t) => setTab(t)} />

        <View style={styles.pane}>
          {tab === 0 && (
            <View style={{ gap: spacing.lg }}>
              {eventsQ.isLoading ? (
                <ActivityIndicator color={colors.pitch} style={{ marginTop: spacing.xl }} />
              ) : (
                <TimelineFeed
                  periods={timeline}
                  homeName={match.homeName}
                  awayName={match.awayName}
                  onPlayerPress={() => haptics.soft()}
                />
              )}
            </View>
          )}
          {tab === 1 &&
            (statsQ.isLoading ? (
              <ActivityIndicator color={colors.pitch} style={{ marginTop: spacing.xl }} />
            ) : statRows.length ? (
              <View style={{ gap: spacing.lg }}>
                {statRows.map((r) => (
                  <StatBar key={r.key} row={r} />
                ))}
              </View>
            ) : (
              <EmptyPane icon="stats-chart-outline" text={match.hasStarted ? 'No stats feed for this competition yet.' : 'Stats open at kickoff.'} />
            ))}
          {tab === 2 &&
            (lineupsQ.isLoading ? (
              <ActivityIndicator color={colors.pitch} style={{ marginTop: spacing.xl }} />
            ) : lineups.length ? (
              <View style={{ gap: spacing.lg }}>
                {[...lineups]
                  .sort((a, b) => (a.teamName === match.homeName ? -1 : b.teamName === match.homeName ? 1 : 0))
                  .map((l) => (
                    <LineupBlock key={l.teamName} lineup={l} homeName={match.homeName} />
                  ))}
              </View>
            ) : (
              <EmptyPane icon="people-outline" text={match.hasStarted ? 'Lineups not published for this match.' : 'Lineups drop about an hour before kickoff.'} />
            ))}
        </View>

        <Text style={styles.footnote}>
          {match.city ? `${match.city} · ` : ''}fixture #{match.id} · api-football.com
        </Text>
      </ScrollView>
    </View>
  );
}

function MatchClock({ match }: { match: UiMatch }) {
  const live = match.status.group === 'live';
  const halft = match.status.group === 'halftime';
  const { minute, stoppage } = useTickingClock(match.elapsed, live, halft, match.extraMinute);
  if (!live) return null;
  return (
    <Text style={styles.clock}>
      {minute}&prime;{stoppage ?? ''}
    </Text>
  );
}

function ScoreSide({
  side,
  logo,
  goals,
  win,
  right,
}: {
  side: string;
  logo: string;
  goals: number | null;
  win: boolean;
  right?: boolean;
}) {
  return (
    <View style={[styles.scoreSide, right && { alignItems: 'flex-end' }]}>
      <TeamLogo name={side} fallbackLogo={logo} size={56} />
      <Text style={[styles.teamBig, win ? { color: colors.text } : { color: colors.textDim }]} numberOfLines={2}>
        {side}
      </Text>
      {win && <Ionicons name="trophy" size={13} color={colors.amber} />}
    </View>
  );
}

function Segmented({ tab, onPick }: { tab: Tab; onPick: (t: Tab) => void }) {
  const { width } = useWindowDimensions();
  const segW = (width - spacing.lg * 2 - 8) / 3;
  const x = useSharedValue(tab * segW);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const pick = (t: Tab) => {
    haptics.tick();
    x.value = withSpring(t * segW, motion.press);
    onPick(t);
  };
  return (
    <View style={styles.segOuter}>
      <View style={styles.segTrack}>
        <Animated.View style={[styles.segPill, { width: segW }, style]} />
        {TAB_LABELS.map((label, i) => (
          <PressableScale
            key={label}
            feel="none"
            onPress={() => pick(i as Tab)}
            style={[styles.segCell, { width: segW }]}
          >
            <Text style={[styles.segText, tab === i && styles.segTextSel]}>{label}</Text>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

function LineupBlock({ lineup, homeName }: { lineup: ReturnType<typeof toUiLineups>[number]; homeName: string }) {
  const [showBench, setShowBench] = useState(false);
  const isHome = lineup.teamName === homeName;
  return (
    <View style={[styles.card, { gap: spacing.sm }]}>
      <View style={styles.lineupHead}>
        <TeamLogo name={lineup.teamName} fallbackLogo={lineup.logo} size={22} />
        <Text style={styles.lineupTeam} numberOfLines={1}>
          {lineup.teamName}
        </Text>
        <View style={styles.formation}>
          <Text style={styles.formationText}>{lineup.formation}</Text>
        </View>
      </View>
      {lineup.starters.map((p, i) => (
        <View key={`${p.id}-${i}`} style={styles.lineupRow}>
          <Text style={styles.shirtNum}>{p.number ?? '—'}</Text>
          <Text style={[styles.lineupName, p.captain && { color: colors.amber }]} numberOfLines={1}>
            {p.name}
            {p.captain ? ' (c)' : ''}
          </Text>
          <Text style={styles.posText}>{p.pos ?? ''}</Text>
          <View style={[styles.sideDot, { backgroundColor: isHome ? colors.pitch : colors.blue }]} />
        </View>
      ))}
      <PressableScale
        feel="soft"
        radiusPx={radius.md}
        onPress={() => {
          haptics.tick();
          setShowBench((v) => !v);
        }}
        style={styles.benchToggle}
      >
        <Ionicons name={showBench ? 'chevron-up' : 'chevron-down'} size={13} color={colors.textDim} />
        <Text style={styles.benchToggleText}>{showBench ? 'Hide' : 'Show'} bench & staff</Text>
      </PressableScale>
      {showBench &&
        lineup.bench.map((p, i) => (
          <View key={`b-${p.id}-${i}`} style={styles.lineupRow}>
            <Text style={[styles.shirtNum, { color: colors.textFaint }]}>{p.number ?? '—'}</Text>
            <Text style={[styles.lineupName, { color: colors.textDim }]} numberOfLines={1}>
              {p.name}
            </Text>
            <Text style={styles.posText}>{p.pos ?? ''}</Text>
          </View>
        ))}
      {lineup.coach ? (
        <View style={[styles.lineupRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.strokeSoft, paddingTop: 6 }]}>
          <Ionicons name="shield-half-outline" size={13} color={colors.textFaint} style={{ width: 26 }} />
          <Text style={[styles.lineupName, { color: colors.textDim }]}>{lineup.coach}</Text>
          <Text style={styles.posText}>Coach</Text>
        </View>
      ) : null}
    </View>
  );
}

function Meta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={12} color={colors.textFaint} />
      <Text style={styles.metaText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

function EmptyPane({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.emptyPane}>
      <Ionicons name={icon} size={24} color={colors.textFaint} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: 'center' },
  errText: { color: colors.danger, fontSize: font.body, textAlign: 'center', paddingHorizontal: spacing.xl },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, gap: spacing.sm },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  leagueTop: { color: colors.text, fontSize: font.small, fontWeight: '800', maxWidth: 230 },
  roundTop: { color: colors.textFaint, fontSize: font.tiny + 1, fontWeight: '600' },

  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke,
  },
  heroScored: { borderColor: colors.pitch + '88' },
  goalFlash: { color: colors.pitch, fontSize: font.h2, fontWeight: '900', letterSpacing: 1.5 },
  scoreSide: { flex: 1, alignItems: 'center', gap: 6, paddingHorizontal: spacing.xs },
  teamBig: { fontSize: font.small + 1.5, fontWeight: '800', textAlign: 'center', color: colors.text },
  centerCol: { alignItems: 'center', gap: 4, minWidth: 110 },
  clock: { color: colors.live, fontSize: font.h3, fontWeight: '900', fontVariant: ['tabular-nums'] },
  heroScore: { color: colors.text, fontSize: 38, fontWeight: '900', letterSpacing: 1, fontVariant: ['tabular-nums'] },
  heroDash: { color: colors.textFaint },
  suffix: { color: colors.amber, fontSize: font.tiny + 1, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  kickoffBig: { color: colors.blue, fontSize: font.small, fontWeight: '800', marginTop: 2 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.sm },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.strokeSoft,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  metaText: { color: colors.textDim, fontSize: font.tiny + 1.5, fontWeight: '600' },

  segOuter: { marginHorizontal: spacing.lg, marginTop: spacing.xl },
  segTrack: { flexDirection: 'row', backgroundColor: colors.strokeSoft, borderRadius: radius.pill, padding: 4 },
  segPill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 0,
    backgroundColor: colors.pitchDim,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.pitch + '55',
  },
  segCell: { paddingVertical: 8, alignItems: 'center' },
  segText: { color: colors.textDim, fontSize: font.small, fontWeight: '700' },
  segTextSel: { color: colors.pitch, fontWeight: '900' },

  pane: { marginHorizontal: spacing.lg, marginTop: spacing.lg },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.stroke, padding: spacing.md },
  emptyPane: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl * 2 },
  lineupHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  lineupTeam: { color: colors.text, fontWeight: '800', fontSize: font.h3, flex: 1 },
  formation: { backgroundColor: colors.blueDim, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  formationText: { color: colors.blue, fontSize: font.tiny + 1, fontWeight: '900' },
  lineupRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 5 },
  shirtNum: { width: 26, color: colors.text, fontWeight: '900', fontSize: font.small, textAlign: 'center', backgroundColor: colors.strokeSoft, borderRadius: 6, paddingVertical: 2, fontVariant: ['tabular-nums'] },
  lineupName: { flex: 1, color: colors.text, fontSize: font.small + 1, fontWeight: '600' },
  posText: { color: colors.textFaint, fontSize: font.tiny + 1, fontWeight: '700', width: 30, textAlign: 'right' },
  sideDot: { width: 6, height: 6, borderRadius: 3 },
  benchToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 7, backgroundColor: colors.strokeSoft, borderRadius: radius.md },
  benchToggleText: { color: colors.textDim, fontSize: font.small, fontWeight: '700' },
  footnote: { color: colors.textFaint, fontSize: font.tiny, textAlign: 'center', marginTop: spacing.xl, marginBottom: spacing.md },
});

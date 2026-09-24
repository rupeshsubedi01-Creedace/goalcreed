/**
 * MatchCard — the scoreboard row. Micro-interactions:
 *  • PressableScale squish + press-down tick
 *  • green "JUST SCORED" flash (bg glow + badge pop) when the score moves
 *  • locally ticking minute between polls
 */
import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';
import { TeamLogo } from './TeamLogo';
import { StatusChip } from './StatusChip';
import { colors, font, radius, spacing } from '@/theme';
import type { UiMatch } from '@/api/normalize';
import { kickoffLabel } from '@/lib/time';
import { useTickingClock } from '@/lib/useTickingClock';

export function MatchCard({
  match,
  onPress,
  flash,
}: {
  match: UiMatch;
  onPress: (id: number) => void;
  flash?: boolean;
}) {
  const live = match.status.group === 'live';
  const halftime = match.status.group === 'halftime';
  const { minute, stoppage } = useTickingClock(match.elapsed, live, halftime, match.extraMinute);

  const flashV = useSharedValue(0);
  React.useEffect(() => {
    if (flash) {
      flashV.value = 0;
      flashV.value = withSequence(
        withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) }),
        withDelay(2200, withTiming(0, { duration: 700 }))
      );
    }
  }, [flash, flashV]);

  const glow = useAnimatedStyle(() => ({
    backgroundColor: `rgba(22,196,127,${0.1 * flashV.value})`,
    borderColor: `rgba(22,196,127,${0.15 + 0.65 * flashV.value})`,
    shadowColor: colors.pitch,
    shadowOpacity: flashV.value * 0.5,
    shadowRadius: 18 * flashV.value,
    shadowOffset: { width: 0, height: 0 },
  }));

  const pop = useAnimatedStyle(() => ({
    opacity: flashV.value,
    transform: [{ scale: 1.08 - 0.08 * flashV.value }],
  }));

  const finished = match.status.group === 'finished';
  const homeWin = finished ? match.homeWinner : live && match.goalsHome > match.goalsAway;
  const awayWin = finished ? match.awayWinner : live && match.goalsAway > match.goalsHome;

  return (
    <PressableScale
      feel="soft"
      radiusPx={radius.lg}
      style={[styles.card, glow as unknown as ViewStyle]}
      onPress={() => onPress(match.id)}
      testID={`match-card-${match.id}`}
    >
      <View style={styles.topRow}>
        <StatusChip
          size="sm"
          status={live ? { ...match.status, chip: `${minute}${stoppage ?? ''}'`, ticking: true } : match.status}
        />
        {!match.hasStarted && (
          <Text style={styles.kickoff}>{kickoffLabel(match.kickoff)}</Text>
        )}
        {flash ? (
          <Animated.View style={[styles.goalBadge, pop]}>
            <Text style={styles.goalBadgeText}>JUST SCORED</Text>
          </Animated.View>
        ) : null}
        <View style={{ flex: 1 }} />
        {live && <Text style={styles.minuteBig}>{minute}</Text>}
      </View>

      <TeamRow
        name={match.homeName}
        short={match.homeShort}
        logo={match.homeLogo}
        goals={match.goalsHome}
        showGoals={match.hasStarted}
        win={homeWin}
      />
      <View style={styles.rowDivider} />
      <TeamRow
        name={match.awayName}
        short={match.awayShort}
        logo={match.awayLogo}
        goals={match.goalsAway}
        showGoals={match.hasStarted}
        win={awayWin}
      />

      <View style={styles.bottomRow}>
        <Text style={styles.round} numberOfLines={1}>
          {cleanRound(match.leagueRound)}
        </Text>
        {match.venue ? (
          <View style={styles.venueWrap}>
            <Ionicons name="location-outline" size={11} color={colors.textFaint} />
            <Text style={styles.venue} numberOfLines={1}>
              {match.venue}
            </Text>
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}

function TeamRow({
  name,
  short,
  logo,
  goals,
  showGoals,
  win,
}: {
  name: string;
  short: string;
  logo: string;
  goals: number;
  showGoals: boolean;
  win: boolean;
}) {
  return (
    <View style={styles.teamRow}>
      <TeamLogo name={name} fallbackLogo={logo} size={26} dim={!win && showGoals} />
      <Text style={[styles.teamName, win ? styles.teamWin : null]} numberOfLines={1}>
        {short}
      </Text>
      {win && <Ionicons name="trophy" size={12} color={colors.amber} style={{ marginLeft: 4 }} />}
      <Text style={[styles.score, showGoals ? null : styles.scoreMuted]}>{showGoals ? goals : '–'}</Text>
    </View>
  );
}

export function cleanRound(round: string): string {
  if (!round) return '';
  const m = round.match(/^(?:Regular Season|League\s*(?:Stage|Phase))(?:\s*-\s*|\s+)(.*)$/i);
  const cleaned = m ? m[1] : round;
  return cleaned.replace(/^-/, '').replace(/-/g, ' ').trim();
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke,
    padding: spacing.md + 2,
    gap: spacing.xs + 2,
    overflow: 'hidden',
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  kickoff: { color: colors.blue, fontSize: font.small, fontWeight: '600' },
  goalBadge: {
    backgroundColor: colors.pitch,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  goalBadgeText: { color: '#04150D', fontSize: font.tiny, fontWeight: '900', letterSpacing: 0.6 },
  minuteBig: { color: colors.live, fontSize: font.h3, fontWeight: '900', fontVariant: ['tabular-nums'] },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  teamName: { flex: 1, color: colors.text, fontSize: font.body + 1, fontWeight: '600' },
  teamWin: { fontWeight: '800' },
  score: { color: colors.text, fontSize: font.h2, fontWeight: '900', fontVariant: ['tabular-nums'], minWidth: 22, textAlign: 'right' },
  scoreMuted: { color: colors.textFaint },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.strokeSoft, marginVertical: 3 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, gap: spacing.sm },
  round: { color: colors.textFaint, fontSize: font.small, flexShrink: 1 },
  venueWrap: { flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: '55%' },
  venue: { color: colors.textFaint, fontSize: font.tiny },
});

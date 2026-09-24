/**
 * TimelineFeed — goal & card chronology, split-half aligned (home events
 * lean left, away events lean right, the spine runs down the middle —
 * the layout football fans can read at a glance).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';
import { colors, font, radius, spacing } from '@/theme';
import type { TimelineItem, TimelinePeriod } from '@/api/normalize';

const ICONS: Record<TimelineItem['kind'], { name: keyof typeof Ionicons.glyphMap; tint: string }> = {
  goal: { name: 'football', tint: colors.pitch },
  'penalty-goal': { name: 'football', tint: colors.pitch },
  'own-goal': { name: 'football', tint: colors.danger },
  'missed-penalty': { name: 'close-circle-outline', tint: colors.amber },
  yellow: { name: 'square', tint: colors.amber },
  red: { name: 'square', tint: colors.live },
  yellowred: { name: 'square', tint: colors.live },
  sub: { name: 'swap-vertical', tint: colors.blue },
  var: { name: 'tv-outline', tint: colors.textDim },
};

const KIND_LABEL: Partial<Record<TimelineItem['kind'], string>> = {
  'penalty-goal': 'pen.',
  'own-goal': 'own goal',
  'missed-penalty': 'missed pen.',
};

export function TimelineFeed({
  periods,
  homeName,
  awayName,
  onPlayerPress,
}: {
  periods: TimelinePeriod[];
  homeName: string;
  awayName: string;
  onPlayerPress?: () => void;
}) {
  if (!periods.length) {
    return (
      <View style={styles.empty}>
        <Ionicons name="stopwatch-outline" size={26} color={colors.textFaint} />
        <Text style={styles.emptyText}>No recorded events yet — the story starts at kickoff.</Text>
      </View>
    );
  }
  let k = 0;
  return (
    <View style={{ gap: spacing.xl }}>
      {periods.map((p, pi) => (
        <View key={`${p.label}-${pi}`} style={{ gap: spacing.md }}>
          <View style={styles.periodRow}>
            <View style={styles.periodLine} />
            <Text style={styles.periodLabel}>
              {p.label.toUpperCase()}
              {(p.goalsHome > 0 || p.goalsAway > 0 || pi > 0) && (
                <Text style={styles.periodScore}>
                  {'  '}
                  {p.goalsHome}–{p.goalsAway}
                </Text>
              )}
            </Text>
            <View style={styles.periodLine} />
          </View>
          {p.items.map((it) => (
            <TimelineRow key={`${it.key}-${k++}`} item={it} homeName={homeName} awayName={awayName} onPlayerPress={onPlayerPress} />
          ))}
        </View>
      ))}
    </View>
  );
}

function TimelineRow({
  item,
  homeName,
  awayName,
  onPlayerPress,
}: {
  item: TimelineItem;
  homeName: string;
  awayName: string;
  onPlayerPress?: () => void;
}) {
  const icon = ICONS[item.kind];
  const home = item.side === 'home';
  const isGoalKind = item.kind === 'goal' || item.kind === 'penalty-goal' || item.kind === 'own-goal';

  return (
    <View style={styles.row}>
      <View style={[styles.side, home ? null : styles.sideEmpty]}>
        {home ? <EventBody item={item} icon={icon} teamName={homeName} isGoalKind={isGoalKind} align="right" onPlayerPress={onPlayerPress} /> : null}
      </View>
      <View style={styles.spine}>
        <View style={[styles.minuteBubble, isGoalKind && styles.minuteBubbleGoal]}>
          <Text style={[styles.minuteText, isGoalKind && { color: colors.pitch }]}>{item.minuteLabel}</Text>
        </View>
      </View>
      <View style={[styles.side, home ? styles.sideEmpty : null]}>
        {!home ? <EventBody item={item} icon={icon} teamName={awayName} isGoalKind={isGoalKind} align="left" onPlayerPress={onPlayerPress} /> : null}
      </View>
    </View>
  );
}

function EventBody({
  item,
  icon,
  teamName,
  isGoalKind,
  align,
  onPlayerPress,
}: {
  item: TimelineItem;
  icon: { name: keyof typeof Ionicons.glyphMap; tint: string };
  teamName: string;
  isGoalKind: boolean;
  align: 'left' | 'right';
  onPlayerPress?: () => void;
}) {
  return (
    <PressableScale
      feel="soft"
      radiusPx={radius.md}
      onPress={onPlayerPress}
      style={[styles.body, align === 'right' ? styles.bodyRight : styles.bodyLeft]}
    >
      {item.photo && isGoalKind ? (
        <Image source={{ uri: item.photo }} style={styles.playerPhoto} contentFit="contain" transition={140} recyclingKey={item.player} />
      ) : (
        <View style={[styles.iconDisc, { backgroundColor: icon.tint + '22' }]}>
          <Ionicons
            name={icon.name}
            size={item.kind === 'yellow' || item.kind === 'red' || item.kind === 'yellowred' ? 11 : 13}
            color={icon.tint}
            style={
              item.kind === 'yellow' || item.kind === 'yellowred'
                ? { transform: [{ rotate: '-8deg' }], borderRadius: 1.5 }
                : item.kind === 'red'
                  ? { transform: [{ rotate: '6deg' }], borderRadius: 1.5 }
                  : undefined
            }
          />
        </View>
      )}
      <View style={{ flexShrink: 1, gap: 1 }}>
        <Text style={styles.player} numberOfLines={1}>
          {item.player}
          {item.kind === 'sub' && item.playerOut ? (
            <Text style={styles.subOut}> ↗ {item.playerOut}</Text>
          ) : null}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {isGoalKind && item.assist && align === 'right' ? `assist ${item.assist} · ` : ''}
          {KIND_LABEL[item.kind] ? `${KIND_LABEL[item.kind]} · ` : ''}
          {item.kind === 'sub' ? 'substitution' : item.kind.startsWith('yellow') ? 'yellow card' : item.kind === 'red' ? 'red card' : item.kind === 'var' ? 'VAR check' : teamName}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  side: { flex: 1, minWidth: 0 },
  sideEmpty: { opacity: 0 },
  spine: { width: 52, alignItems: 'center' },
  minuteBubble: {
    backgroundColor: colors.bgElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
    minWidth: 44,
    alignItems: 'center',
  },
  minuteBubbleGoal: { borderColor: colors.pitch + '66', backgroundColor: colors.pitchDim },
  minuteText: { color: colors.textDim, fontSize: font.tiny + 1, fontWeight: '800', fontVariant: ['tabular-nums'] },
  body: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, maxWidth: '100%' },
  bodyRight: { justifyContent: 'flex-end' },
  bodyLeft: { justifyContent: 'flex-start' },
  playerPhoto: { width: 30, height: 30, borderRadius: radius.sm, backgroundColor: colors.cardHi },
  iconDisc: { width: 26, height: 26, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  player: { color: colors.text, fontSize: font.small + 1, fontWeight: '700' },
  subOut: { color: colors.textFaint, fontWeight: '500', fontSize: font.small },
  meta: { color: colors.textFaint, fontSize: font.tiny + 1 },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl * 1.5 },
  emptyText: { color: colors.textFaint, fontSize: font.small, textAlign: 'center', paddingHorizontal: spacing.xl },
  periodRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  periodLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.stroke },
  periodLabel: { color: colors.textFaint, fontSize: font.tiny + 1, fontWeight: '800', letterSpacing: 1.2 },
  periodScore: { color: colors.textDim },
});

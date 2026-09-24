/**
 * StatBar — mirrored bar with animated fill (home grows right-to-left? no:
 * home fills from centre→left visually is overkill; we use classic:
 * left half = home, right half = away, each filling toward the outside).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, font, radius, spacing, motion } from '@/theme';
import type { StatRow } from '@/api/types';

export function StatBar({ row }: { row: StatRow }) {
  const total = row.home + row.away || 1;
  const homePct = Math.min(0.92, Math.max(0.08, row.home / total));
  const awayPct = Math.min(0.92, Math.max(0.08, row.away / total));

  const h = useSharedValue(0);
  const a = useSharedValue(0);
  React.useEffect(() => {
    h.value = withTiming(homePct, { duration: motion.slow });
    a.value = withTiming(awayPct, { duration: motion.slow });
  }, [homePct, awayPct, h, a]);

  const homeStyle = useAnimatedStyle(() => ({ width: `${h.value * 100}%` }));
  const awayStyle = useAnimatedStyle(() => ({ width: `${a.value * 100}%` }));

  const dominance = row.home === row.away ? 'even' : row.home > row.away ? 'home' : 'away';

  return (
    <View style={styles.wrap}>
      <View style={styles.valueRow}>
        <Text style={[styles.value, dominance === 'home' && styles.valueLead]}>{row.displayHome}</Text>
        <Text style={styles.label}>{row.label}</Text>
        <Text style={[styles.value, dominance === 'away' && styles.valueLead]}>{row.displayAway}</Text>
      </View>
      <View style={styles.track}>
        <View style={styles.halfTrack}>
          <Animated.View style={[styles.homeFill, homeStyle, { borderRadius: row.away === 0 ? radius.pill : 0 }]} />
        </View>
        <View style={styles.centerTick} />
        <View style={styles.halfTrack}>
          <Animated.View
            style={[styles.awayFill, awayStyle, { alignSelf: 'flex-end', borderRadius: row.home === 0 ? radius.pill : 0 }]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  valueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 },
  value: { width: 54, fontSize: font.h3, fontWeight: '800', color: colors.textDim, fontVariant: ['tabular-nums'] },
  valueLead: { color: colors.text },
  label: { fontSize: font.small, color: colors.textFaint, fontWeight: '600', letterSpacing: 0.3 },
  track: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.strokeSoft, borderRadius: radius.pill, height: 6, overflow: 'hidden' },
  halfTrack: { flex: 1, height: '100%', justifyContent: 'center' },
  homeFill: { height: '100%', backgroundColor: colors.pitch, opacity: 0.9 },
  awayFill: { height: '100%', backgroundColor: colors.blue, opacity: 0.9 },
  centerTick: { width: 1, height: 12, backgroundColor: colors.bg, marginHorizontal: 1 },
});

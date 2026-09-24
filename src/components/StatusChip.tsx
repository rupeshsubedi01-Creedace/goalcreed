import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, font, radius, spacing } from '@/theme';
import { LiveDot } from './LiveDot';
import type { StatusInfo } from '@/lib/time';

const toneFor = (s: StatusInfo) => {
  switch (s.group) {
    case 'live':
      return { fg: colors.live, bg: colors.liveDim };
    case 'halftime':
      return { fg: colors.amber, bg: colors.amberDim };
    case 'finished':
      return { fg: colors.textFaint, bg: colors.strokeSoft };
    case 'scheduled':
      return { fg: colors.blue, bg: colors.blueDim };
    default:
      return { fg: colors.textDim, bg: colors.strokeSoft };
  }
};

export function StatusChip({ status, size = 'md' }: { status: StatusInfo; size?: 'sm' | 'md' }) {
  const tone = toneFor(status);
  const isLive = status.group === 'live';
  return (
    <View
      style={[
        styles.chip,
        size === 'sm' && styles.chipSm,
        { backgroundColor: tone.bg, borderColor: tone.fg + '44' },
      ]}
    >
      {isLive && <LiveDot size={size === 'sm' ? 6 : 7} />}
      <Text style={[styles.text, size === 'sm' && styles.textSm, { color: tone.fg }]}>
        {isLive ? status.chip : status.group === 'scheduled' ? status.chip.toUpperCase() : status.chip.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
  chipSm: { paddingHorizontal: spacing.sm - 2, paddingVertical: 2, gap: 4 },
  text: { fontSize: font.small, fontWeight: '800', letterSpacing: 0.6 },
  textSm: { fontSize: font.tiny },
});

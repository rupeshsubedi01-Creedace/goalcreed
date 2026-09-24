import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, spacing } from '@/theme';

/** Screen title block with big display type + optional live meta line. */
export function Header({
  title,
  meta,
  right,
}: {
  title: string;
  meta?: React.ReactNode;
  right?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + spacing.md }]} pointerEvents="box-none">
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {meta ? <View style={styles.meta}>{meta}</View> : null}
        </View>
        {right}
      </View>
    </View>
  );
}

export function LiveMeta({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <View style={styles.liveMeta}>
      <Text style={[styles.liveText, accent && { color: colors.live }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  title: { color: colors.text, fontSize: font.display, fontWeight: '900', letterSpacing: -0.6 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  liveMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveText: { color: colors.textDim, fontSize: font.small, fontWeight: '600' },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useTeamCrest } from '@/lib/crests';
import { colors, font } from '@/theme';


export function TeamLogo({
  name,
  fallbackLogo,
  size = 34,
  dim = false,
}: {
  name: string;
  fallbackLogo: string;
  size?: number;
  dim?: boolean;
}) {
  const { uri } = useTeamCrest(name, fallbackLogo);
  if (!uri) {
    const initials = name
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    return (
      <View
        style={[
          styles.fallback,
          { width: size, height: size, borderRadius: size * 0.32, opacity: dim ? 0.55 : 1 },
        ]}
      >
        <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{initials}</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, opacity: dim ? 0.72 : 1 }}
      contentFit="contain"
      transition={180}
      recyclingKey={name}
      accessibilityLabel={`${name} crest`}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.cardHi,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: colors.textDim, fontWeight: '700' },
});

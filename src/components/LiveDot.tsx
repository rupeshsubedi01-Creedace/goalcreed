import React from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors } from '@/theme';

/** Pulsing red dot — the universal "LIVE" heartbeat. */
export function LiveDot({ size = 8, color = colors.live }: { size?: number; color?: string }) {
  const v = useSharedValue(0.35);
  React.useEffect(() => {
    v.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 620, easing: Easing.out(Easing.quad) }),
        withTiming(0.35, { duration: 900, easing: Easing.in(Easing.quad) })
      ),
      -1,
      false
    );
  }, [v]);
  const style = useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ scale: 0.86 + v.value * 0.24 }],
  }));
  return (
    <Animated.View
      style={[{ width: size, height: size, borderRadius: size, backgroundColor: color }, style]}
    />
  );
}

/**
 * PressableScale — the touch primitive every interactive element in
 * GoalCreed is built on:
 *   • spring press-scale (squish to 0.96 while held, springy overshoot on release)
 *   • pressed-state tint + border glow
 *   • haptic fired on press-DOWN (not on release) so feedback is felt
 *     before the action even commits
 */
import React from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withDelay,
  interpolateColor,
} from 'react-native-reanimated';
import { colors, motion } from '@/theme';
import * as haptics from '@/lib/haptics';

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  /** haptic weight per information scent: firm = primary, soft = dense rows, tick = pickers */
  feel?: 'firm' | 'soft' | 'tick' | 'none';
  style?: StyleProp<ViewStyle>;
  /** border radius to keep the pressed tint clipped */
  radiusPx?: number;
  hitSlop?: number;
  testID?: string;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressableScale({
  children,
  onPress,
  onLongPress,
  disabled,
  feel = 'firm',
  style,
  radiusPx,
  hitSlop = 6,
  testID,
}: Props) {
  const pressed = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: withSpring(pressed.value ? 0.962 : 1, pressed.value ? motion.press : motion.release),
        },
      ],
      backgroundColor: interpolateColor(pressed.value, [0, 1], ['rgba(0,0,0,0)', colors.pressed]),
      borderColor: interpolateColor(
        pressed.value,
        [0, 1],
        ['rgba(0,0,0,0)', disabled ? 'rgba(0,0,0,0)' : 'rgba(77,154,255,0.35)']
      ),
    };
  });

  const pressIn = () => {
    if (disabled) return;
    if (feel === 'firm') haptics.tap();
    else if (feel === 'soft') haptics.soft();
    else if (feel === 'tick') haptics.tick();
    pressed.value = withTiming(1, { duration: 28 });
  };

  const pressOut = () => {
    // slight hold before release so quick taps still feel "clicked"
    pressed.value = withDelay(30, withTiming(0, { duration: 60 }));
  };

  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={hitSlop}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={[styles.base, radiusPx != null && { borderRadius: radiusPx }, style, animStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0)',
  },
});

export { Animated };

/**
 * GoalCreed haptics engine — single funnel for every touch response.
 *
 * Design rules:
 *  - Every tappable element answers back within the first frames of the
 *    press (press-in tick), so the UI feels "active", not reactive.
 *  - Selection ticks for scrolling pickers/segmented controls.
 *  - Notification haptics are reserved for state changes worth feeling
 *    (a goal, a refresh success, an error).
 *  - One global kill-switch (Settings) so the engine no-ops cheaply.
 */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

let enabled = true;

export function setHapticsEnabled(v: boolean) {
  enabled = v;
}
export function isHapticsEnabled() {
  return enabled;
}

const safe = (fn: () => Promise<unknown> | void) => {
  if (!enabled) return;
  try {
    const r = fn();
    if (r && typeof (r as Promise<unknown>).catch === 'function') {
      (r as Promise<unknown>).catch(() => {}); // never let haptics crash a touch
    }
  } catch {
    /* expo-haptics throws on unsupported devices — ignore */
  }
};

/** Firm response for primary actions (buttons, cards, back, save). */
export const tap = () =>
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));

/** Softer response for secondary/dense UI (chips, list rows, close). */
export const soft = () =>
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

/** Snappy click for press-in feedback (fires the instant a finger lands). */
export const pressIn = () =>
  safe(() =>
    Platform.OS === 'android'
      ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      : Haptics.selectionAsync()
  );

/** Detent tick for pickers / segmented controls / date strips. */
export const tick = () => safe(() => Haptics.selectionAsync());

/** Completion buzzes — these use the system notification patterns. */
export const success = () =>
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
export const warning = () =>
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
export const error = () =>
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));

/**
 * GOAL — the signature vibration of GoalCreed.
 * A success thud followed by two quick light knocks (1-2… GOAL rhythm),
 * then a long soft roll. Composed from primitives so it works on
 * stock Android via expo-haptics without a native module.
 */
export const goal = () => {
  if (!enabled) return;
  success();
  setTimeout(() => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)), 220);
  setTimeout(() => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)), 340);
  setTimeout(() => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)), 520);
};

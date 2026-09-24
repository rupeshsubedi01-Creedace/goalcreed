/**
 * GoalCreed — dark-mode-first design tokens.
 * The whole app is designed on this palette; light mode is intentionally
 * out of scope so contrast/legibility stay predictable in a stadium-bar
 * context (one-handed glanceable scores).
 */

export const colors = {
  // Surfaces
  bg: '#070B12',
  bgElevated: '#0B111D',
  card: '#111A2B',
  cardHi: '#182338',
  stroke: '#1E2C47',
  strokeSoft: '#16223A',

  // Text
  text: '#EDF3FC',
  textDim: '#93A6C6',
  textFaint: '#5D7093',

  // Brand / semantic
  pitch: '#16C47F', // primary green — goals, live-positive, CTAs
  pitchDim: 'rgba(22,196,127,0.14)',
  live: '#FF3B5C', // live pulse
  liveDim: 'rgba(255,59,92,0.14)',
  amber: '#FFB020', // HT / extra time / cards
  amberDim: 'rgba(255,176,32,0.14)',
  blue: '#4D9AFF', // links, info
  blueDim: 'rgba(77,154,255,0.14)',
  danger: '#FF5C5C',
  away: '#7A8CA8',

  // Statuses
  upcoming: '#5D7093',
  finished: '#3F4E68',

  // Touch feedback
  pressed: 'rgba(237,243,252,0.06)',
  ripple: 'rgba(77,154,255,0.25)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

export const font = {
  display: 30,
  h1: 22,
  h2: 17,
  h3: 15,
  body: 14,
  small: 12,
  tiny: 10,
} as const;

export const motion = {
  /** spring used for press-scale micro-interactions */
  press: { damping: 18, stiffness: 320, mass: 0.7 },
  /** spring used for releasing a press */
  release: { damping: 14, stiffness: 260, mass: 0.8 },
  /** timed animations (bars, flashes) */
  fast: 180,
  base: 280,
  slow: 520,
} as const;

/** Navigation / status bar polish for the dark shell */
export const navTheme = {
  dark: true,
  colors: {
    primary: colors.pitch,
    background: colors.bg,
    card: colors.bgElevated,
    text: colors.text,
    border: colors.stroke,
    notification: colors.live,
  },
} as const;

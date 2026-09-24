import { StyleSheet } from 'react-native';
import { colors, font, radius, spacing } from '@/theme';

/** Small shared styles reused across screens */
export const shared = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  pad: {
    paddingHorizontal: spacing.lg,
  },
  gapSm: { gap: spacing.sm },
  gapMd: { gap: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke,
  },
  hRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textDim: { color: colors.textDim },
  caption: { color: colors.textFaint, fontSize: font.small },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.stroke,
    marginVertical: spacing.md,
  },
});

import { StyleSheet } from 'react-native';

import { BevveTheme as theme } from '@/constants/theme';

// Shared by the drink-price, spoken-language and safety forms.
export const inlineFormStyles = StyleSheet.create({
  form: {
    gap: theme.spacing.md
  },
  label: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12,
    lineHeight: 19
  },
  hint: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    lineHeight: 18
  },
  eyebrow: {
    color: theme.colors.purpleLight,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm
  },
  option: {
    minHeight: 44,
    justifyContent: 'center',
    flexShrink: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.control
  },
  selected: {
    borderColor: theme.colors.accentBorder,
    backgroundColor: theme.colors.purpleButton
  },
  selectedLabel: { color: theme.colors.onAccent },
  input: {
    minHeight: 50,
    width: '100%',
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.purpleBorder,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surfaceRaised,
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    fontSize: 14
  },
  multiline: {
    height: 120,
    textAlignVertical: 'top'
  },
  info: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.purpleTint
  },
  tag: {
    flexShrink: 1,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.purpleTint,
    color: theme.colors.purpleText,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 11,
    lineHeight: 18
  },
  error: {
    color: theme.colors.star,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    lineHeight: 18
  },
  success: {
    color: theme.colors.success,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12,
    lineHeight: 19
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm
  },
  button: {
    flexGrow: 1,
    flexBasis: 100,
    paddingHorizontal: theme.spacing.md
  },
  pressed: {
    opacity: 0.7
  }
});

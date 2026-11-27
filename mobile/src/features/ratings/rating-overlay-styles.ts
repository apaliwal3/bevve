import { StyleSheet } from 'react-native';
import { BevveTheme as theme } from '@/constants/theme';

export const ratingOverlayStyles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start'
  },
  backdrop: {
    backgroundColor: theme.colors.overlayBackdrop
  },
  panel: {
    width: '100%',
    maxWidth: 374,
    flexShrink: 1,
    borderRadius: theme.radii.panel,
    borderWidth: 1,
    borderColor: theme.colors.purpleBorder,
    backgroundColor: theme.colors.overlaySurface,
    overflow: 'hidden'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderColor: theme.colors.border
  },
  headerCopy: {
    flex: 1,
    gap: theme.spacing.xs
  },
  eyebrow: {
    color: theme.colors.purpleLight,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1
  },
  venueName: {
    color: theme.colors.text,
    fontFamily: theme.fonts.brand,
    fontSize: 21,
    lineHeight: 28
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surfaceRaised
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.md
  },
  ratingCard: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.purpleBorder,
    borderRadius: theme.radii.card,
    backgroundColor: theme.colors.purpleTint
  },
  question: {
    color: theme.colors.text,
    fontFamily: theme.fonts.brand,
    fontSize: 22,
    lineHeight: 29
  },
  description: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
    fontSize: 12,
    lineHeight: 19
  },
  optionalCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden'
  },
  expandedCard: {
    borderColor: theme.colors.purpleBorder
  },
  cardSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    gap: theme.spacing.sm,
    padding: theme.spacing.md
  },
  cardIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.purpleTint
  },
  cardCopy: {
    flex: 1,
    gap: theme.spacing.xs
  },
  cardTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 14
  },
  hint: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    lineHeight: 17
  },
  euro: {
    color: theme.colors.purpleLight,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 19
  },
  placeholder: {
    borderTopWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.sm
  },
  pressed: {
    opacity: 0.7
  }
});

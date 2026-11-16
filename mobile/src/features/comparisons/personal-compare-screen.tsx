import { useTranslation } from '@/localization/language-provider';
import { StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import AppTabs from '@/components/app-tabs';
import { Logo } from '@/components/logo';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenContainer } from '@/components/screen-container';
import { BevveTheme as theme } from '@/constants/theme';
import type { Venue } from '@/types/venue';

import { usePersonalComparisons } from './personal-comparisons-provider';
import { PreferenceVenueCard } from './preference-venue-card';

type PersonalCompareScreenProps = { onViewVenue: (venue: Venue) => void };

export function PersonalCompareScreen({ onViewVenue }: PersonalCompareScreenProps) {
  const { t } = useTranslation();
  const { pair, round, phase, feedback, savedCount, winnerName, onlyOnePair, choose, skip } = usePersonalComparisons();
  const choosing = phase === 'feedback';
  const step = round % 5 + 1;
  const selectedId = choosing && feedback?.kind === 'vote' ? feedback.winnerId : null;

  return (
    <View style={styles.screen}>
      <ScreenContainer edges={['top', 'left', 'right']} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Logo />
          <Text style={styles.pill}>{t("QUICK PICK")}</Text>
        </View>
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>{t("PERSONAL PREFERENCES")}</Text>
          <Text accessibilityRole="header" style={styles.title}>{t("Which would you")}{'\n'}{t("rather") + " "}<Text style={styles.accent}>{t("revisit?")}</Text></Text>
          <Text style={styles.description}>{t("Tap your pick. No overthinking.")}</Text>
          <Text style={styles.meta}>{t("Build your own relative ranking. Community star ratings stay separate.")}</Text>
        </View>

        {pair ? (
          <>
            <View style={styles.pair}>
              {pair.map((venue, index) => (
                <View key={venue.id} style={[styles.option, index === 0 && styles.firstOption]}>
                  <PreferenceVenueCard
                    venue={venue}
                    otherName={pair[index === 0 ? 1 : 0].name}
                    selected={selectedId === venue.id.toLowerCase()}
                    faded={selectedId !== null && selectedId !== venue.id.toLowerCase()}
                    disabled={choosing}
                    onChoose={() => choose(venue.id)}
                    onView={() => onViewVenue(venue)}
                  />
                  {index === 0 && <View pointerEvents="none" style={styles.versus}><Text style={styles.versusLabel}>{t("OR")}</Text></View>}
                </View>
              ))}
            </View>
            <View style={styles.hintRow}>
              <Text style={styles.meta}>{t("Tap a card to choose")}</Text>
              <View accessibilityLabel={t('Quick pick {step} of 5', { step })} style={styles.dots}>
                {[1, 2, 3, 4, 5].map((item) => <View key={item} style={[styles.dot, item === step && styles.activeDot]} />)}
              </View>
            </View>
            <Text accessibilityLiveRegion="polite" style={styles.feedback}>
              {feedback?.kind === 'vote' ? t('{name} saved as your preference.', { name: winnerName ?? t('Your choice') })
                : feedback?.kind === 'skip' ? t("Skipped — no comparison saved.") : t("Choose the place you would rather revisit.")}
            </Text>
            <PrimaryButton label={t("Not sure — skip this one")} variant="secondary" disabled={choosing} onPress={skip} style={styles.skip} />
            {onlyOnePair && <Text style={styles.meta}>{t("Only one pair is available in this demo. You can revisit it or skip.")}</Text>}
          </>
        ) : (
          <View style={styles.empty}>
            <AppIcon name="compare" size={30} color={theme.colors.purpleLight} />
            <Text style={styles.emptyTitle}>{t("No pair available yet")}</Text>
            <Text style={styles.description}>{t("At least two different venues are needed for a personal comparison.")}</Text>
          </View>
        )}
        <Text accessibilityLiveRegion="polite" style={styles.saved}>{t('{count} personal comparisons saved this session', { count: savedCount })}</Text>
        <Text style={styles.meta}>{t("DEMO VENUES · Preferences reset on a full app reload.")}</Text>
      </ScreenContainer>
      <AppTabs />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.md
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44
  },
  pill: {
    color: theme.colors.purpleLight,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    borderColor: theme.colors.purpleBorder,
    backgroundColor: theme.colors.purpleTint
  },
  intro: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.xxl,
    paddingBottom: theme.spacing.md
  },
  eyebrow: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1.4
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.fonts.brand,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -1.2,
    textAlign: 'center'
  },
  accent: {
    color: theme.colors.purpleLight
  },
  description: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center'
  },
  meta: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center'
  },
  pair: {
    gap: 14
  },
  option: {
    position: 'relative'
  },
  firstOption: {
    zIndex: 1
  },
  versus: {
    position: 'absolute',
    bottom: -24,
    left: '50%',
    marginLeft: -18,
    zIndex: 2,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: theme.colors.background,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surfaceRaised
  },
  versusLabel: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 9
  },
  hintRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.sm
  },
  dots: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    alignItems: 'center'
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surfaceRaised
  },
  activeDot: {
    width: 14,
    backgroundColor: theme.colors.purple
  },
  feedback: {
    color: theme.colors.purpleText,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center'
  },
  skip: {
    backgroundColor: theme.colors.transparent,
    borderWidth: 0
  },
  saved: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12,
    textAlign: 'center'
  },
  empty: {
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.xxl,
    borderRadius: theme.radii.card,
    backgroundColor: theme.colors.surface
  },
  emptyTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 20,
    textAlign: 'center'
  }
});

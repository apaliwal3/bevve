import { useTranslation } from '@/localization/language-provider';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/app-icon';
import { CrowdMeter } from '@/components/crowd-meter';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenContainer } from '@/components/screen-container';
import { BevveTheme as theme } from '@/constants/theme';
import { VenueRatingOverlay } from '@/features/ratings/venue-rating-overlay';
import { useVenueContributions, useVenueExtras, useVenueRating } from '@/features/ratings/venue-ratings-provider';
import { venueLanguageLabel, venueServingLabel } from '@/localization/venue-copy';
import { crowdClassificationLabels } from '@/features/contributions/contribution-state';
import type { BathroomCategorySummary, Venue, VenueDetails } from '@/types/venue';


type BarDetailsScreenProps = {
  venue: Venue;
  details?: VenueDetails;
  onBack: () => void;
  backLabel?: string;
  onComparePrices: () => void;
};

export function BarDetailsScreen({ venue, details, onBack, backLabel, onComparePrices }: BarDetailsScreenProps) {
  const { t, format, describe } = useTranslation();
  const insets = useSafeAreaInsets();
  const [imageFailed, setImageFailed] = useState(false);
  const [ratingOverlayOpen, setRatingOverlayOpen] = useState(false);
  const demoCrowd = details?.crowd;
  const { crowdSummary: crowd, bathroomSummary: bathrooms, ownBathroomReview, now } = useVenueContributions(venue.id, details?.bathrooms);
  const crowdKnown = crowd.classification !== null;
  const { communityRating: rating } = useVenueRating(venue);
  const { drinks, pendingLanguages } = useVenueExtras(venue.id);
  const languages = details?.languages ?? [];

  return (
    <>
    <ScreenContainer edges={['left', 'right']}>
      <View style={[styles.hero, { minHeight: insets.top + 300 }]}>
        {venue.image && !imageFailed ? (
          <Image source={venue.image} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} onError={() => setImageFailed(true)} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.photoPlaceholder]}>
            <AppIcon name="photo" size={32} />
            <Text style={styles.meta}>{t("Photo unavailable")}</Text>
          </View>
        )}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.heroShade]} />
        <View style={[styles.backRow, { paddingTop: insets.top + theme.spacing.lg }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={backLabel ?? t('Back to Explore')} onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <AppIcon name="back" color={theme.colors.text} />
          </Pressable>
        </View>
        <View style={styles.heroCopy}>
          {details?.openingHoursLabel && (
            <View style={styles.hoursBadge}>
              <Text style={styles.hoursLabel}>{describe(details.openingHoursLabel)}</Text>
            </View>
          )}
          <View style={styles.nameRow}>
            <Text accessibilityRole="header" style={styles.name}>{venue.name}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Open actions for {name}', { name: venue.name })}
              accessibilityHint={t('Open experience, personal comparisons and optional bar actions')}
              onPress={() => setRatingOverlayOpen(true)}
              style={({ pressed }) => [styles.plusButton, pressed && styles.plusPressed]}>
              <AppIcon name="plus" size={20} color={theme.colors.text} />
            </Pressable>
          </View>
          <View style={styles.locationRow}>
            <AppIcon name="pin" size={15} color={theme.colors.textSecondary} />
            <Text style={styles.location}>{venue.area}, {details?.city ?? t("City unavailable")} · {venue.distanceLabel ? describe(venue.distanceLabel) : t("Distance unavailable")}</Text>
          </View>
          {details?.address && <Text style={styles.location}>{details.address}</Text>}
        </View>
      </View>

      <View style={[styles.body, { paddingBottom: Math.max(42, insets.bottom + theme.spacing.xxl) }]}>
        <Text style={styles.demoLabel}>{t("DEMO DATA · Sample venue information")}</Text>

        <View style={[styles.card, styles.crowdCard]}>
          <View style={styles.summaryRow}>
            <View style={styles.flexCopy}>
              <Text style={styles.sectionLabel}>{t("LIVE CROWD · SESSION REPORTS")}</Text>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                {crowd.classification ? describe(crowdClassificationLabels[crowd.classification]) : t("Not enough recent reports")}
                {crowdKnown && crowd.score !== null && <Text style={styles.crowdScore}> {format.number(crowd.score)}/5</Text>}
              </Text>
            </View>
            {crowdKnown && crowd?.score !== null && crowd?.score !== undefined && <CrowdMeter level={crowd.score} />}
          </View>
          <View style={styles.freshness}>
            <Text style={styles.meta}>
              {crowd.newest_report_at === null
                ? t("No recent update")
                : t('Updated {time}', { time: format.relativeTime(crowd.newest_report_at, now) })}
            </Text>
            <Text style={styles.meta}>{t('{count} recent contributors · 45 min window', { count: crowd.report_count })}</Text>
          </View>
          {!crowdKnown && <Text style={styles.description}>{t("At least 3 different contributors are needed within 45 minutes.")}</Text>}
          {demoCrowd && demoCrowd.score !== null && (
            <Text style={styles.meta}>{t('Fictional demo snapshot: {score}/5 from {count} reports. Not included in session crowd.', { score: format.number(demoCrowd.score), count: demoCrowd.reportCount })}</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>{t("Drink prices")}</Text>
          <Text style={styles.meta}>{t("Community-reported · Not verified · Demo session")}</Text>
          <View style={[styles.card, styles.drinkList]}>
            {drinks.length === 0 && <Text style={styles.description}>{t("No drink prices reported yet.")}</Text>}
            {drinks.map((drink, index) => (
              <View key={drink.id} style={[styles.drinkRow, index > 0 && styles.drinkSeparator]}>
                <View style={styles.drinkSymbol}><Text style={styles.drinkInitial}>{drink.name[0]}</Text></View>
                <View style={styles.flexCopy}>
                  <Text style={styles.drinkName}>{drink.name}</Text>
                  <Text style={styles.meta}>{venueServingLabel(drink, t)}</Text>
                  {drink.observedAt && <Text style={styles.meta}>{t('Reported {date}', { date: format.dateTime(drink.observedAt) })}</Text>}
                </View>
                <Text style={styles.price}>
                  {drink.priceCents === null ? t("Not reported") : format.currency(drink.priceCents)}
                </Text>
              </View>
            ))}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t("Compare drink prices")} accessibilityHint={t("View community-reported prices across Milan")} onPress={onComparePrices} style={({ pressed }) => [styles.textAction, pressed && styles.pressed]}>
            <Text style={styles.actionLabel}>{t("Compare prices across Milan")}</Text>
            <AppIcon name="chevron" size={16} color={theme.colors.purpleLight} />
          </Pressable>
        </View>

        <View style={styles.infoGrid}>
          <View style={[styles.card, styles.infoCard]}>
            <Text style={styles.starIcon} accessible={false}>★</Text>
            <Text style={styles.sectionLabel}>{t("BAR RATING")}</Text>
            {rating && rating.count > 0 ? (
              <>
                <Text style={styles.ratingValue}>{format.decimal(rating.average)} <Text style={styles.outOfFive}>/ 5</Text></Text>
                <Text style={styles.meta}>{t('{count} community bar ratings', { count: rating.count })}</Text>
              </>
            ) : <Text style={styles.description}>{t("No community bar ratings yet.")}</Text>}
          </View>
          <View style={[styles.card, styles.infoCard]}>
            <AppIcon name="languages" size={22} color={theme.colors.purpleLight} />
            <Text style={styles.sectionLabel}>{t("SPOKEN LANGUAGES")}</Text>
            <View style={styles.languageList}>
              {languages.map((language) => <Text key={language.code} style={styles.languageTag}>{venueLanguageLabel(language.code, t, language.name)}</Text>)}
            </View>
            {languages.length === 0 && <Text style={styles.description}>{t("No languages reported yet.")}</Text>}
            {pendingLanguages.length > 0 && (
              <>
                <Text style={styles.meta}>{t("Suggestions awaiting review")}</Text>
                <View style={styles.languageList}>
                  {pendingLanguages.map((suggestion) => <Text key={suggestion.id} style={styles.languageTag}>{venueLanguageLabel(suggestion.language_code, t)} · {t('Pending')}</Text>)}
                </View>
              </>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t("BATHROOM RATINGS")}</Text>
          <View style={styles.summaryRow}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, styles.flexCopy]}>{t("Community averages")}</Text>
            <Text style={styles.meta}>{t('{count} reviews', { count: bathrooms?.reviewCount ?? 0 })}</Text>
          </View>
          {!bathrooms || bathrooms.reviewCount === 0 ? <Text style={styles.description}>{t("No bathroom reviews yet.")}</Text> : null}
          <View style={styles.bathroomGrid}>
            <BathroomSummary label={t("Cleanliness")} summary={bathrooms?.cleanliness} />
            <BathroomSummary label={t("Accessibility")} summary={bathrooms?.accessibility} />
            <BathroomSummary label={t("Waiting time")} summary={bathrooms?.waitTime} />
          </View>
          <Text style={styles.meta}>{t("Separate from the overall bar rating. A waiting-time score of 5 means a shorter wait.")}</Text>
          {ownBathroomReview && <Text style={styles.meta}>{details?.bathrooms ? t('Includes your session review and the fictional demo baseline.') : t('Includes your session review.')}</Text>}
        </View>

        <View style={[styles.card, styles.safetyCard]}>
          <View style={styles.summaryRow}>
            <AppIcon name="safety" size={24} color={theme.colors.success} />
            <View style={styles.flexCopy}>
              <Text style={[styles.sectionLabel, styles.safetyLabel]}>{t("DEMO DATA")}</Text>
              <Text accessibilityRole="header" style={styles.sectionTitle}>{t("Safety information")}</Text>
            </View>
          </View>
          {(details?.demoSafetyNotes ?? []).map((note, index) => (
            <View key={index} style={styles.safetyNote}>
              <Text style={styles.sectionLabel}>{t("FICTIONAL EXAMPLE · DEMO DATA")}</Text>
              <Text style={styles.description}>{note}</Text>
            </View>
          ))}
          {!details?.demoSafetyNotes.length && <Text style={styles.description}>{t("No published safety information.")}</Text>}
          <Text style={styles.description}>{t("This preview contains no real verified safety records. Missing information does not guarantee safety.")}</Text>
        </View>
      </View>
    </ScreenContainer>
    {ratingOverlayOpen && <VenueRatingOverlay venue={venue} onClose={() => setRatingOverlayOpen(false)} />}
    </>
  );
}

function BathroomSummary({ label, summary }: { label: string; summary?: BathroomCategorySummary }) {
  const { t, format } = useTranslation();
  const average = summary?.average ?? null;
  const hasRatings = summary && summary.count > 0 && average !== null;
  return (
    <View style={styles.bathroomTile}>
      <Text style={styles.meta}>{label}</Text>
      <Text style={styles.bathroomValue}>{hasRatings ? format.decimal(average) + ' ★' : t("No ratings")}</Text>
      <Text style={styles.meta}>{t('{count} ratings', { count: summary?.count ?? 0 })}</Text>
    </View>
  );
}

export function MissingVenueScreen({ reason, onBack }: { reason: 'invalid' | 'not-found'; onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <ScreenContainer contentContainerStyle={styles.missing}>
      <AppIcon name="pin" size={32} color={theme.colors.purpleLight} />
      <Text accessibilityRole="header" style={styles.sectionTitle}>{reason === 'invalid' ? t("Invalid venue link") : t("Venue not found")}</Text>
      <Text style={styles.description}>{reason === 'invalid' ? t("This link is missing a valid venue ID.") : t("This venue is not available in the demo catalog.")}</Text>
      <PrimaryButton label={t("Back to Explore")} onPress={onBack} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: theme.colors.surfaceRaised
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm
  },
  heroShade: {
    backgroundImage: `linear-gradient(180deg, ${theme.colors.imageBadge}, ${theme.colors.transparent} 42%, ${theme.colors.background} 100%)`
  },
  backRow: {
    paddingHorizontal: 18
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.imageBadge,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  heroCopy: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingTop: theme.spacing.huge,
    paddingBottom: theme.spacing.xl,
    paddingHorizontal: 18,
    gap: theme.spacing.sm
  },
  hoursBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.successTint,
    borderColor: theme.colors.successBorder,
    borderWidth: 1
  },
  hoursLabel: {
    color: theme.colors.success,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 11
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.md
  },
  name: {
    flex: 1,
    minWidth: 0,
    color: theme.colors.text,
    fontFamily: theme.fonts.brand,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -1.3
  },
  plusButton: {
    width: 44,
    height: 44,
    flexShrink: 0,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.purpleButton,
    borderWidth: 1,
    borderColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center'
  },
  plusPressed: { backgroundColor: theme.colors.purpleButtonPressed },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs
  },
  location: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
    fontSize: 12,
    lineHeight: 18
  },
  body: {
    paddingHorizontal: 18,
    gap: theme.spacing.lg
  },
  demoLabel: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 10
  },
  card: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    gap: theme.spacing.sm
  },
  crowdCard: {
    borderColor: theme.colors.purpleBorder,
    backgroundImage: `linear-gradient(135deg, ${theme.colors.purpleTint}, ${theme.colors.surface})`
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm
  },
  flexCopy: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing.xs
  },
  sectionLabel: {
    color: theme.colors.purpleLight,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1
  },
  sectionTitle: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 19,
    lineHeight: 26
  },
  crowdScore: {
    color: theme.colors.purpleLight,
    fontSize: 14
  },
  freshness: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: theme.spacing.sm
  },
  meta: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    lineHeight: 17
  },
  description: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
    fontSize: 13,
    lineHeight: 20
  },
  section: {
    gap: theme.spacing.sm
  },
  drinkList: {
    paddingVertical: 0
  },
  drinkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md
  },
  drinkSeparator: {
    borderTopWidth: 1,
    borderColor: theme.colors.border
  },
  drinkSymbol: {
    width: 31,
    height: 31,
    borderRadius: theme.radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.purpleTint
  },
  drinkInitial: {
    color: theme.colors.purpleLight,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 13
  },
  drinkName: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 13
  },
  price: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 14
  },
  textAction: {
    minHeight: 44,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm
  },
  actionLabel: {
    color: theme.colors.purpleLight,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md
  },
  infoCard: {
    flex: 1,
    flexBasis: 140,
    minHeight: 140,
    alignItems: 'flex-start'
  },
  starIcon: {
    color: theme.colors.star,
    fontSize: 22
  },
  ratingValue: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 26
  },
  outOfFive: {
    color: theme.colors.star,
    fontSize: 15
  },
  languageList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs
  },
  languageTag: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.surfaceRaised
  },
  bathroomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm
  },
  bathroomTile: {
    flexGrow: 1,
    flexBasis: 80,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.radii.sm,
    gap: theme.spacing.xs
  },
  bathroomValue: {
    color: theme.colors.star,
    fontFamily: theme.fonts.heading,
    fontSize: 16
  },
  safetyCard: {
    borderColor: theme.colors.successBorder
  },
  safetyLabel: {
    color: theme.colors.success
  },
  safetyNote: {
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm
  },
  missing: {
    padding: theme.spacing.xxl,
    justifyContent: 'center',
    gap: theme.spacing.lg
  },
  pressed: {
    opacity: 0.7
  }
});

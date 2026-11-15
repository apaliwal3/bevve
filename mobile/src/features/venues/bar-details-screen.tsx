import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/app-icon';
import { CrowdMeter } from '@/components/crowd-meter';
import { PreviewNotice } from '@/components/preview-notice';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenContainer } from '@/components/screen-container';
import { BevveTheme as theme } from '@/constants/theme';
import { VenueRatingOverlay } from '@/features/ratings/venue-rating-overlay';
import { useVenueRating } from '@/features/ratings/venue-ratings-provider';
import type { BathroomCategorySummary, Venue, VenueDetails } from '@/types/venue';

import { hasSufficientCrowdData } from './venue-details';

type BarDetailsScreenProps = { venue: Venue; details?: VenueDetails; onBack: () => void };

export function BarDetailsScreen({ venue, details, onBack }: BarDetailsScreenProps) {
  const insets = useSafeAreaInsets();
  const [imageFailed, setImageFailed] = useState(false);
  const [ratingOverlayOpen, setRatingOverlayOpen] = useState(false);
  const [pricesNotice, setPricesNotice] = useState(false);
  const crowd = details?.crowd;
  const crowdKnown = hasSufficientCrowdData(crowd);
  const { communityRating: rating } = useVenueRating(venue);
  const bathrooms = details?.bathrooms;
  const drinks = details?.drinks ?? [];
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
            <Text style={styles.meta}>Photo unavailable</Text>
          </View>
        )}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.heroShade]} />
        <View style={[styles.backRow, { paddingTop: insets.top + theme.spacing.lg }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to Explore" onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <AppIcon name="back" color={theme.colors.text} />
          </Pressable>
        </View>
        <View style={styles.heroCopy}>
          {details?.openingHoursLabel && (
            <View style={styles.hoursBadge}>
              <Text style={styles.hoursLabel}>{details.openingHoursLabel}</Text>
            </View>
          )}
          <View style={styles.nameRow}>
            <Text accessibilityRole="header" style={styles.name}>{venue.name}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open actions for ${venue.name}`}
              accessibilityHint="Open overall rating and optional bar actions"
              onPress={() => setRatingOverlayOpen(true)}
              style={({ pressed }) => [styles.plusButton, pressed && styles.pressed]}>
              <AppIcon name="plus" size={20} color={theme.colors.text} />
            </Pressable>
          </View>
          <View style={styles.locationRow}>
            <AppIcon name="pin" size={15} color={theme.colors.textSecondary} />
            <Text style={styles.location}>{venue.area}, {details?.city ?? 'City unavailable'} · {venue.distanceLabel ?? 'Distance unavailable'}</Text>
          </View>
          {details?.address && <Text style={styles.location}>{details.address}</Text>}
        </View>
      </View>

      <View style={[styles.body, { paddingBottom: Math.max(42, insets.bottom + theme.spacing.xxl) }]}>
        <Text style={styles.demoLabel}>DEMO DATA · Sample venue information</Text>

        <View style={[styles.card, styles.crowdCard]}>
          <View style={styles.summaryRow}>
            <View style={styles.flexCopy}>
              <Text style={styles.sectionLabel}>LIVE CROWD · DEMO</Text>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                {crowdKnown ? (venue.crowd?.label ?? 'Reported crowd') : 'Unknown'}
                {crowdKnown && <Text style={styles.crowdScore}> {crowd?.score}/5</Text>}
              </Text>
            </View>
            {crowdKnown && crowd?.score !== null && crowd?.score !== undefined && <CrowdMeter level={crowd.score} />}
          </View>
          <View style={styles.freshness}>
            <Text style={styles.meta}>
              {crowd?.newestReportAgeMinutes === null || crowd?.newestReportAgeMinutes === undefined
                ? 'No recent update'
                : `Sample update: ${crowd.newestReportAgeMinutes} min ago`}
            </Text>
            <Text style={styles.meta}>{crowd?.reportCount ?? 0} reports · 45 min window</Text>
          </View>
          {!crowdKnown && <Text style={styles.description}>Not enough recent reports to show a reliable crowd status.</Text>}
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Drink prices</Text>
          <Text style={styles.meta}>Community-reported · Demo prices</Text>
          <View style={[styles.card, styles.drinkList]}>
            {drinks.length === 0 && <Text style={styles.description}>No drink prices reported yet.</Text>}
            {drinks.map((drink, index) => (
              <View key={drink.id} style={[styles.drinkRow, index > 0 && styles.drinkSeparator]}>
                <View style={styles.drinkSymbol}><Text style={styles.drinkInitial}>{drink.name[0]}</Text></View>
                <View style={styles.flexCopy}>
                  <Text style={styles.drinkName}>{drink.name}</Text>
                  <Text style={styles.meta}>{drink.serving}</Text>
                </View>
                <Text style={styles.price}>
                  {drink.priceCents === null ? 'Not reported' : new Intl.NumberFormat('en-IE', { style: 'currency', currency: drink.currency }).format(drink.priceCents / 100)}
                </Text>
              </View>
            ))}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Compare drink prices" accessibilityHint="Read-only price comparison is coming soon" onPress={() => setPricesNotice(true)} style={({ pressed }) => [styles.textAction, pressed && styles.pressed]}>
            <Text style={styles.actionLabel}>Compare prices across Milan</Text>
            <AppIcon name="chevron" size={16} color={theme.colors.purpleLight} />
          </Pressable>
          {pricesNotice && <PreviewNotice message="Read-only drink price comparison is coming soon." onDismiss={() => setPricesNotice(false)} />}
        </View>

        <View style={styles.infoGrid}>
          <View style={[styles.card, styles.infoCard]}>
            <Text style={styles.starIcon} accessible={false}>★</Text>
            <Text style={styles.sectionLabel}>BAR RATING</Text>
            {rating && rating.count > 0 ? (
              <>
                <Text style={styles.ratingValue}>{rating.average.toFixed(1)} <Text style={styles.outOfFive}>/ 5</Text></Text>
                <Text style={styles.meta}>{rating.count} community bar ratings</Text>
              </>
            ) : <Text style={styles.description}>No community bar ratings yet.</Text>}
          </View>
          <View style={[styles.card, styles.infoCard]}>
            <AppIcon name="languages" size={22} color={theme.colors.purpleLight} />
            <Text style={styles.sectionLabel}>SPOKEN LANGUAGES</Text>
            <View style={styles.languageList}>
              {languages.map((language) => <Text key={language.code} style={styles.languageTag}>{language.name}</Text>)}
            </View>
            {languages.length === 0 && <Text style={styles.description}>No languages reported yet.</Text>}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>BATHROOM RATINGS</Text>
          <View style={styles.summaryRow}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, styles.flexCopy]}>Community averages</Text>
            <Text style={styles.meta}>{bathrooms?.reviewCount ?? 0} reviews</Text>
          </View>
          {!bathrooms || bathrooms.reviewCount === 0 ? <Text style={styles.description}>No bathroom reviews yet.</Text> : null}
          <View style={styles.bathroomGrid}>
            <BathroomSummary label="Cleanliness" summary={bathrooms?.cleanliness} />
            <BathroomSummary label="Accessibility" summary={bathrooms?.accessibility} />
            <BathroomSummary label="Waiting time" summary={bathrooms?.waitTime} />
          </View>
          <Text style={styles.meta}>Separate from the overall bar rating. A waiting-time score of 5 means a shorter wait.</Text>
        </View>

        <View style={[styles.card, styles.safetyCard]}>
          <View style={styles.summaryRow}>
            <AppIcon name="safety" size={24} color={theme.colors.success} />
            <View style={styles.flexCopy}>
              <Text style={[styles.sectionLabel, styles.safetyLabel]}>DEMO DATA</Text>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Safety information</Text>
            </View>
          </View>
          {(details?.demoSafetyNotes ?? []).map((note, index) => (
            <View key={index} style={styles.safetyNote}>
              <Text style={styles.sectionLabel}>FICTIONAL EXAMPLE · DEMO DATA</Text>
              <Text style={styles.description}>{note}</Text>
            </View>
          ))}
          {!details?.demoSafetyNotes.length && <Text style={styles.description}>No published safety information.</Text>}
          <Text style={styles.description}>This preview contains no real verified safety records. Missing information does not guarantee safety.</Text>
        </View>
      </View>
    </ScreenContainer>
    {ratingOverlayOpen && <VenueRatingOverlay venue={venue} onClose={() => setRatingOverlayOpen(false)} />}
    </>
  );
}

function BathroomSummary({ label, summary }: { label: string; summary?: BathroomCategorySummary }) {
  const hasRatings = summary && summary.count > 0 && summary.average !== null;
  return (
    <View style={styles.bathroomTile}>
      <Text style={styles.meta}>{label}</Text>
      <Text style={styles.bathroomValue}>{hasRatings ? `${summary.average?.toFixed(1)} ★` : 'No ratings'}</Text>
      <Text style={styles.meta}>{summary?.count ?? 0} ratings</Text>
    </View>
  );
}

export function MissingVenueScreen({ reason, onBack }: { reason: 'invalid' | 'not-found'; onBack: () => void }) {
  return (
    <ScreenContainer contentContainerStyle={styles.missing}>
      <AppIcon name="pin" size={32} color={theme.colors.purpleLight} />
      <Text accessibilityRole="header" style={styles.sectionTitle}>{reason === 'invalid' ? 'Invalid venue link' : 'Venue not found'}</Text>
      <Text style={styles.description}>{reason === 'invalid' ? 'This link is missing a valid venue ID.' : 'This venue is not available in the demo catalog.'}</Text>
      <PrimaryButton label="Back to Explore" onPress={onBack} />
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
    backgroundColor: theme.colors.purple,
    borderWidth: 1,
    borderColor: theme.colors.purpleLight,
    alignItems: 'center',
    justifyContent: 'center'
  },
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

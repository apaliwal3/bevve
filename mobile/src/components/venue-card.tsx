import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BevveTheme as theme } from '@/constants/theme';
import { useVenueContributions, useVenueRating } from '@/features/ratings/venue-ratings-provider';
import { crowdClassificationLabels } from '@/features/contributions/contribution-state';
import type { Venue } from '@/types/venue';

import { AppIcon } from './app-icon';
import { CrowdMeter } from './crowd-meter';

type VenueCardProps = { venue: Venue; onPress?: () => void };

export function VenueCard({ venue, onPress }: VenueCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const { communityRating: rating } = useVenueRating(venue);
  const { ownCrowdReport, crowdSummary, bathroomSummary } = useVenueContributions(venue.id);
  const crowdLevel = ownCrowdReport ? (crowdSummary.classification ? crowdSummary.score : null) : venue.crowd?.level;
  const crowdLabel = ownCrowdReport
    ? (crowdSummary.classification ? crowdClassificationLabels[crowdSummary.classification] : 'Not enough recent reports')
    : venue.crowd?.label ?? 'No reports yet';
  const bathroomCleanliness = bathroomSummary?.cleanliness.average ?? null;
  const ratingLabel = rating && rating.count > 0
    ? `★ ${rating.average.toFixed(1)}/5`
    : 'No ratings yet';
  const priceLabel =
    venue.startingPriceCents === null
      ? 'No prices yet'
      : new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(
          venue.startingPriceCents / 100,
        );
  const content = (
    <>
      <View style={styles.photo}>
        {venue.image && !imageFailed ? (
          <Image
            source={venue.image}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            accessible={false}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.photoPlaceholder]}>
            <AppIcon name="photo" size={28} />
            <Text style={styles.metricLabel}>Photo unavailable</Text>
          </View>
        )}
        <View style={styles.badges}>
          <View style={styles.areaBadge}>
            <AppIcon name="pin" size={12} color={theme.colors.text} />
            <Text style={styles.areaLabel}>{venue.area}</Text>
          </View>
          <Text
            accessibilityLabel={rating && rating.count > 0
              ? `Community bar rating: ${rating.average.toFixed(1)} out of 5, ${rating.count} ratings`
              : 'No community bar ratings yet'}
            style={[styles.badge, styles.rating]}>
            {ratingLabel}
          </Text>
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            <Text style={styles.name}>{venue.name}</Text>
            <Text style={styles.subtitle}>{venue.vibe} · {venue.distanceLabel ?? 'Distance unavailable'}</Text>
          </View>
          {onPress && (
            <Text style={styles.arrow} accessible={false}>›</Text>
          )}
        </View>
        <View style={styles.metrics}>
          <View style={styles.metric}>
            <View style={styles.metricIcon}>
              <AppIcon name="crowd" size={15} color={theme.colors.purpleLight} />
            </View>
            <View style={styles.metricCopy}>
              <Text style={styles.metricLabel}>{ownCrowdReport ? 'Session crowd' : 'Demo crowd'}</Text>
              <Text style={styles.metricValue}>{crowdLabel}</Text>
              {crowdLevel !== null && crowdLevel !== undefined && <CrowdMeter level={crowdLevel} />}
            </View>
          </View>
          <View style={styles.metric}>
            <View style={styles.metricIcon}>
              <Text style={styles.currencyIcon} accessible={false}>€</Text>
            </View>
            <View style={styles.metricCopy}>
              <Text style={styles.metricLabel}>Drinks from</Text>
              <Text style={styles.metricValue}>{priceLabel}</Text>
            </View>
          </View>
          <View style={styles.metric}>
            <View style={styles.metricIcon}>
              <AppIcon name="bathroom" size={15} color={theme.colors.purpleLight} />
            </View>
            <View style={styles.metricCopy}>
              <Text style={styles.metricLabel}>Bathrooms</Text>
              <Text style={styles.metricValue}>
                {bathroomCleanliness === null
                  ? 'No reviews yet'
                  : `${bathroomCleanliness.toFixed(1)} ★`}
              </Text>
              {bathroomCleanliness !== null && <Text style={styles.metricLabel}>Cleanliness</Text>}
            </View>
          </View>
        </View>
      </View>
    </>
  );

  if (!onPress) return <View style={styles.card}>{content}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${venue.name}, ${venue.area}, ${ratingLabel}. View venue`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden'
  },
  photo: {
    height: 174,
    backgroundColor: theme.colors.surfaceRaised
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm
  },
  badges: {
    position: 'absolute',
    top: theme.spacing.md,
    left: theme.spacing.md,
    right: theme.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing.sm
  },
  areaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    flexShrink: 1,
    backgroundColor: theme.colors.imageBadge,
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs
  },
  areaLabel: {
    flexShrink: 1,
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 11
  },
  badge: {
    flexShrink: 1,
    backgroundColor: theme.colors.imageBadge,
    color: theme.colors.text,
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 11
  },
  rating: {
    color: theme.colors.star
  },
  body: {
    padding: theme.spacing.lg
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm
  },
  titleCopy: {
    flex: 1
  },
  name: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 19
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    marginTop: theme.spacing.xs
  },
  arrow: {
    color: theme.colors.purpleLight,
    fontSize: 28
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.md
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexGrow: 1,
    flexBasis: 90,
    gap: theme.spacing.xs
  },
  metricIcon: {
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.purpleTint,
  },
  metricCopy: { flex: 1, gap: theme.spacing.xs },
  currencyIcon: {
    color: theme.colors.purpleLight,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 14,
    lineHeight: 16
  },
  metricLabel: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 10
  },
  metricValue: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 11
  },
  pressed: {
    opacity: 0.85
  }
});

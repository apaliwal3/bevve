import { useTranslation } from '@/localization/language-provider';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BevveTheme as theme } from '@/constants/theme';
import { useVenueContributions, useVenueCrowdSelector, useVenueExtras } from '@/features/ratings/venue-ratings-provider';
import { useVenueOpinion } from '@/features/comparisons/personal-comparisons-provider';
import { CommunityOpinionSummary, communityOpinionLabel } from '@/features/impressions/community-opinion-summary';
import { impressionLabels } from '@/features/impressions/impression-selector';
import type { Venue } from '@/types/venue';

import { AppIcon } from './app-icon';
import { CrowdMeter } from './crowd-meter';

type VenueCardProps = { venue: Venue; onPress?: () => void };

export function VenueCard({ venue, onPress }: VenueCardProps) {
  const { t, format, describe } = useTranslation();
  const [imageFailed, setImageFailed] = useState(false);
  const { community, ownImpression } = useVenueOpinion(venue.id);
  const { bathroomSummary } = useVenueContributions(venue.id);
  const crowdFor = useVenueCrowdSelector();
  const crowd = crowdFor(venue);
  const { startingPriceCents } = useVenueExtras(venue.id);
  const crowdLabel = crowd.label !== null ? describe(crowd.label)
    : crowd.source === 'session' ? t('Not enough recent reports') : t('No reports yet');
  const bathroomCleanliness = bathroomSummary?.cleanliness.average ?? null;
  const impressionLabel = ownImpression
    ? t('Your impression: {impression} · Demo session', { impression: t(impressionLabels[ownImpression]) })
    : t('No saved impression');
  const priceLabel =
    startingPriceCents === null
      ? t('No prices yet')
      : format.currency(startingPriceCents);
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
            <Text style={styles.metricLabel}>{t("Photo unavailable")}</Text>
          </View>
        )}
        <View style={styles.badges}>
          <View style={styles.areaBadge}>
            <AppIcon name="pin" size={12} color={theme.colors.text} />
            <Text style={styles.areaLabel}>{venue.area}</Text>
          </View>
          <CommunityOpinionSummary opinion={community} compact />
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            <Text style={styles.name}>{venue.name}</Text>
            <Text style={styles.subtitle}>{describe(venue.vibe)} · {venue.distanceLabel ? describe(venue.distanceLabel) : t("Distance unavailable")}</Text>
          </View>
          {onPress && (
            <Text style={styles.arrow} accessible={false}>›</Text>
          )}
        </View>
        {ownImpression && <Text style={styles.metricLabel}>{impressionLabel}</Text>}
        <View style={styles.metrics}>
          <View style={styles.metric}>
            <View style={styles.metricIcon}>
              <AppIcon name="crowd" size={15} color={theme.colors.purpleLight} />
            </View>
            <View style={styles.metricCopy}>
              <Text style={styles.metricLabel}>{crowd.source === 'session' ? t("Session crowd") : t("Demo crowd")}</Text>
              <Text style={styles.metricValue}>{crowdLabel}</Text>
              {crowd.level !== null && <CrowdMeter level={crowd.level} />}
            </View>
          </View>
          <View style={styles.metric}>
            <View style={styles.metricIcon}>
              <Text style={styles.currencyIcon} accessible={false}>€</Text>
            </View>
            <View style={styles.metricCopy}>
              <Text style={styles.metricLabel}>{t("Community prices from")}</Text>
              <Text style={styles.metricValue}>{priceLabel}</Text>
              <Text style={styles.metricLabel}>{t("Not verified")}</Text>
            </View>
          </View>
          <View style={styles.metric}>
            <View style={styles.metricIcon}>
              <AppIcon name="bathroom" size={15} color={theme.colors.purpleLight} />
            </View>
            <View style={styles.metricCopy}>
              <Text style={styles.metricLabel}>{t("Bathrooms")}</Text>
              <Text style={styles.metricValue}>
                {bathroomCleanliness === null
                  ? t("No reviews yet")
                  : format.decimal(bathroomCleanliness) + ' ★'}
              </Text>
              {bathroomCleanliness !== null && <Text style={styles.metricLabel}>{t("Cleanliness")}</Text>}
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
      accessibilityLabel={t('{name}, {area}. {opinion}. {impression}. View venue', { name: venue.name, area: venue.area, opinion: communityOpinionLabel(community, t), impression: impressionLabel })}
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

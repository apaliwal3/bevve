import { BookmarkButton } from '@/features/saved-bars/bookmark-button';
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
import type { AccountVenueData } from '@/features/catalog/catalog-adapters';

import { AppIcon } from './app-icon';
import { CrowdMeter } from './crowd-meter';

type VenueCardProps = { venue: Venue; onPress?: () => void; account?: AccountVenueData };

export function VenueCard({ venue, onPress, account }: VenueCardProps) {
  const { t, format, describe } = useTranslation();
  const [imageFailed, setImageFailed] = useState(false);
  const demoOpinion = useVenueOpinion(venue.id);
  const { community, ownImpression } = account ?? demoOpinion;
  const demoContributions = useVenueContributions(venue.id);
  const bathroomSummary = account ? account.bathrooms : demoContributions.bathroomSummary;
  const crowdFor = useVenueCrowdSelector();
  const crowd = account ? { source: 'backend', level: account.crowd.classification ? account.crowd.score : null,
    label: account.crowd.classification, isQuiet: account.crowd.classification === 'quiet' } : crowdFor(venue);
  const extras = useVenueExtras(venue.id);
  const startingPriceCents = account ? account.startingPriceCents : extras.startingPriceCents;
  const crowdLabel = crowd.label !== null ? describe(crowd.label)
    : crowd.source !== 'demo' ? t('Not enough recent reports') : t('No reports yet');
  const bathroomCleanliness = bathroomSummary?.cleanliness.average ?? null;
  const impressionLabel = ownImpression
    ? account ? t('Your impression: {impression} · Saved to your account', { impression: t(impressionLabels[ownImpression]) })
      : t('Your impression: {impression} · Demo session', { impression: t(impressionLabels[ownImpression]) })
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
        {ownImpression && <View accessible={!onPress} accessibilityRole="image" accessibilityLabel={impressionLabel}
          pointerEvents="none" style={styles.impressionBadge}>
          <AppIcon name={ownImpression === 'disliked' ? 'thumbsDown' : 'thumbsUp'} size={16} color={theme.colors.onAccent} />
          {ownImpression === 'liked' && <AppIcon name="thumbsUp" size={16} color={theme.colors.onAccent} />}
        </View>}
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            <Text style={styles.name}>{venue.name}</Text>
            <Text style={styles.subtitle}>{venue.distanceLabel ? describe(venue.distanceLabel) : t("Distance unavailable")}</Text>
          </View>
          {onPress && (
            <Text style={styles.arrow} accessible={false}>›</Text>
          )}
        </View>
        <View style={styles.metrics}>
          <View style={styles.metric}>
            <View style={styles.metricHeader}>
              <AppIcon name="crowd" size={13} color={theme.colors.textMuted} />
              <Text style={styles.metricLabel}>{t('Crowd')}</Text>
            </View>
            <View style={styles.metricCopy}>
              <Text style={[styles.metricValue, styles.crowdValue, crowd.level === null && styles.missingValue]}>{crowdLabel}</Text>
              {crowd.level !== null && <CrowdMeter level={crowd.level} />}
            </View>
          </View>
          <View style={styles.metric}>
            <View style={styles.metricHeader}>
              <Text style={styles.currencyIcon} accessible={false}>€</Text>
              <Text style={styles.metricLabel}>{t('Prices from')}</Text>
            </View>
            <View style={styles.metricCopy}>
              <Text style={[styles.metricValue, startingPriceCents === null && styles.missingValue]}>{priceLabel}</Text>
            </View>
          </View>
          <View style={styles.metric}>
            <View style={styles.metricHeader}>
              <AppIcon name="bathroom" size={13} color={theme.colors.textMuted} />
              <Text style={styles.metricLabel}>{t("Bathrooms")}</Text>
            </View>
            <View style={styles.metricCopy}>
              <Text style={[styles.metricValue, bathroomCleanliness === null && styles.missingValue]}>
                {bathroomCleanliness === null
                  ? t("No reviews yet")
                  : format.decimal(bathroomCleanliness) + ' ★'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </>
  );

  return (
    <View style={styles.card}>
    {onPress ? <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('{name}, {area}. {opinion}. {impression}. View venue', { name: venue.name, area: venue.area, opinion: communityOpinionLabel(community, t), impression: impressionLabel })}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable> : content}
    <View style={styles.bookmarkPosition}><BookmarkButton barId={venue.id} name={venue.name} /></View>
    </View>
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
  bookmarkPosition: { position: 'absolute', top: 122, left: theme.spacing.sm },
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
  impressionBadge: {
    position: 'absolute',
    bottom: theme.spacing.md,
    right: theme.spacing.md,
    minHeight: 28,
    flexDirection: 'row',
    gap: theme.spacing.xs,
    paddingHorizontal: 10,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    borderColor: theme.colors.purpleBorder,
    backgroundColor: theme.colors.purpleButton,
    alignItems: 'center',
    justifyContent: 'center'
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
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 70,
    gap: theme.spacing.sm
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    minHeight: 18
  },
  metricCopy: { flex: 1, gap: theme.spacing.xs },
  currencyIcon: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12,
    lineHeight: 16
  },
  metricLabel: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 10,
    flexShrink: 1
  },
  metricValue: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 22,
    lineHeight: 28
  },
  crowdValue: { fontSize: 18, lineHeight: 28 },
  missingValue: { color: theme.colors.textSecondary, fontFamily: theme.fonts.body, fontSize: 11, lineHeight: 17 },
  pressed: {
    opacity: 0.85
  }
});

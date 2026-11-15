import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BevveTheme as theme } from '@/constants/theme';
import type { Venue } from '@/types/venue';

type VenueCardProps = { venue: Venue; onPress?: () => void };

export function VenueCard({ venue, onPress }: VenueCardProps) {
  const ratingLabel = venue.communityRating
    ? `★ ${venue.communityRating.average.toFixed(1)}/5`
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
        <Image
          source={venue.image}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          accessible={false}
        />
        <View style={styles.badges}>
          <Text style={styles.badge}>{venue.area}</Text>
          <Text style={[styles.badge, styles.rating]}>{ratingLabel}</Text>
        </View>
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            <Text style={styles.name}>{venue.name}</Text>
            <Text style={styles.subtitle}>{venue.vibe} · {venue.distanceLabel}</Text>
          </View>
          {onPress && (
            <Text style={styles.arrow} accessible={false}>›</Text>
          )}
        </View>
        <View style={styles.metrics}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Crowd</Text>
            <Text style={styles.metricValue}>{venue.crowd?.label ?? 'No reports yet'}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Drinks from</Text>
            <Text style={styles.metricValue}>{priceLabel}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Cleanliness</Text>
            <Text style={styles.metricValue}>
              {venue.bathroomCleanliness === null
                ? 'No reviews yet'
                : `${venue.bathroomCleanliness.toFixed(1)} ★`}
            </Text>
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
    overflow: 'hidden',
  },
  photo: { height: 174, backgroundColor: theme.colors.surfaceRaised },
  badges: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  badge: {
    flexShrink: 1,
    backgroundColor: theme.colors.imageBadge,
    color: theme.colors.text,
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 11,
  },
  rating: { color: theme.colors.star },
  body: { padding: theme.spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  titleCopy: { flex: 1 },
  name: { color: theme.colors.text, fontFamily: theme.fonts.heading, fontSize: 19 },
  subtitle: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    marginTop: theme.spacing.xs,
  },
  arrow: { color: theme.colors.purpleLight, fontSize: 28 },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  metric: { flexGrow: 1, flexBasis: 80, gap: theme.spacing.xs },
  metricLabel: { color: theme.colors.textMuted, fontFamily: theme.fonts.body, fontSize: 10 },
  metricValue: { color: theme.colors.text, fontFamily: theme.fonts.bodyBold, fontSize: 11 },
  pressed: { opacity: 0.85 },
});

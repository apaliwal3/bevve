import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { BevveTheme as theme } from '@/constants/theme';

import type { PersonalRankingEntry } from './personal-rankings';

type RankedVenueRowProps = { entry: PersonalRankingEntry; onPress: () => void };

export function RankedVenueRow({ entry, onPress }: RankedVenueRowProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const { venue, position, comparisonCount } = entry;
  const ordinal = '#' + position;
  const accent = position === 1 ? styles.gold : position === 2 ? styles.silver : position === 3 ? styles.bronze : undefined;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={'Personal rank ' + ordinal + ': ' + venue.name + ', ' + venue.area + '. ' + comparisonCount + ' comparisons. View Bar Details'}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Text style={[styles.position, accent]}>{ordinal}</Text>
      <View style={styles.photo}>
        {venue.image && !imageFailed
          ? <Image source={venue.image} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} onError={() => setImageFailed(true)} />
          : <AppIcon name="photo" size={20} />}
      </View>
      <View style={styles.copy}>
        <Text style={styles.name}>{venue.name}</Text>
        <Text style={styles.area}>{venue.area} · {venue.vibe}</Text>
        <Text style={styles.meta}>{comparisonCount} {comparisonCount === 1 ? 'comparison' : 'comparisons'}</Text>
      </View>
      <View style={styles.cue}>
        <Text style={[styles.badge, position === 1 && styles.goldBadge, accent]}>{ordinal}</Text>
        <AppIcon name="chevron" size={15} color={theme.colors.purpleLight} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 86,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md
  },
  position: {
    width: 32,
    color: theme.colors.purpleLight,
    fontFamily: theme.fonts.brand,
    fontSize: 16,
    textAlign: 'center'
  },
  gold: {
    color: theme.colors.star
  },
  silver: {
    color: theme.colors.textSecondary
  },
  bronze: {
    color: '#fbbf24'
  },
  photo: {
    width: 47,
    height: 47,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing.xs
  },
  name: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 13
  },
  area: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    lineHeight: 17
  },
  meta: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.body,
    fontSize: 10,
    lineHeight: 16
  },
  cue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs
  },
  badge: {
    color: theme.colors.purpleLight,
    backgroundColor: theme.colors.purpleTint,
    borderRadius: theme.radii.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    fontFamily: theme.fonts.brand,
    fontSize: 11
  },
  goldBadge: {
    backgroundColor: theme.colors.starTint
  },
  pressed: {
    opacity: 0.75
  }
});

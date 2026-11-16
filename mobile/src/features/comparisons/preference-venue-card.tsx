import { useTranslation } from '@/localization/language-provider';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/app-icon';
import { BevveTheme as theme } from '@/constants/theme';
import type { Venue } from '@/types/venue';

type PreferenceVenueCardProps = {
  venue: Pick<Venue, 'id' | 'name' | 'area' | 'vibe' | 'image'>;
  otherName: string;
  selected: boolean;
  faded: boolean;
  disabled: boolean;
  onChoose: () => void;
  onView: () => void;
};

export function PreferenceVenueCard({ venue, otherName, selected, faded, disabled, onChoose, onView }: PreferenceVenueCardProps) {
  const { t, describe } = useTranslation();
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <View style={[styles.card, selected && styles.selected, faded && styles.faded]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('Prefer {name} over {other}', { name: venue.name, other: otherName })}
        accessibilityHint={t("Save your personal preference and show the next pair")}
        accessibilityState={{ selected, disabled }}
        disabled={disabled}
        onPress={onChoose}
        style={({ pressed }) => [styles.choice, pressed && styles.pressed]}>
        {venue.image && !imageFailed ? (
          <Image source={venue.image} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} onError={() => setImageFailed(true)} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
            <AppIcon name="photo" size={28} />
            <Text style={styles.vibe}>{t("Photo unavailable")}</Text>
          </View>
        )}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.shade]} />
        {selected && <View style={styles.check}><Text accessible={false} style={styles.checkText}>✓</Text></View>}
        <View style={styles.copy}>
          <Text style={styles.area}>{venue.area.toUpperCase()}</Text>
          <Text style={styles.name}>{venue.name}</Text>
          <Text style={styles.vibe}>{describe(venue.vibe)}</Text>
        </View>
      </Pressable>
      {/* Sibling controls: opening details must never bubble into a preference vote. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('View details for {name}', { name: venue.name })}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onView}
        style={({ pressed }) => [styles.viewBar, pressed && styles.pressed]}>
        <Text style={styles.viewLabel}>{t("View bar")}</Text>
        <AppIcon name="chevron" size={12} color={theme.colors.purpleLight} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden'
  },
  selected: {
    borderColor: theme.colors.purpleLight
  },
  faded: {
    opacity: 0.5
  },
  choice: {
    minHeight: 210,
    justifyContent: 'flex-end',
    paddingTop: 80,
    paddingBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm
  },
  shade: {
    backgroundImage: 'linear-gradient(180deg, ' + theme.colors.photoShade + ', ' + theme.colors.transparent + ' 30%, ' + theme.colors.imageBadge + ' 100%)'
  },
  copy: {
    gap: theme.spacing.xs
  },
  area: {
    color: theme.colors.purpleText,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1
  },
  name: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 23
  },
  vibe: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
    fontSize: 12,
    lineHeight: 18
  },
  check: {
    position: 'absolute',
    top: theme.spacing.md,
    left: theme.spacing.md,
    width: 34,
    height: 34,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.purple
  },
  checkText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 21
  },
  viewBar: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.imageBadge
  },
  viewLabel: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 11
  },
  pressed: {
    opacity: 0.8
  }
});

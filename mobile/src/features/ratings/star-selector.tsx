import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BevveTheme as theme } from '@/constants/theme';

import type { StarRating } from './rating-state';

const stars: readonly StarRating[] = [1, 2, 3, 4, 5];

export function StarSelector({
  value,
  onChange,
  disabled = false,
  label = 'Overall bar rating',
}: { value: StarRating | null; onChange: (rating: StarRating) => void; disabled?: boolean; label?: string }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.row}>
      {stars.map((star) => (
        <Pressable
          key={star}
          accessibilityRole="radio"
          accessibilityLabel={`${label}: ${star} ${star === 1 ? 'star' : 'stars'} out of 5`}
          accessibilityState={{ checked: value === star, disabled }}
          disabled={disabled}
          onPress={() => onChange(star)}
          style={({ pressed }) => [styles.star, value !== null && star <= value && styles.active, pressed && styles.pressed]}>
          <Text allowFontScaling={false} accessible={false} style={[styles.glyph, value !== null && star <= value && styles.activeGlyph]}>★</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.xs },
  star: {
    flex: 1,
    minWidth: 44,
    maxWidth: 48,
    minHeight: 48,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: { borderColor: theme.colors.star, backgroundColor: theme.colors.starTint },
  glyph: { color: theme.colors.textSubtle, fontSize: 26 },
  activeGlyph: { color: theme.colors.star },
  pressed: { opacity: 0.7 },
});

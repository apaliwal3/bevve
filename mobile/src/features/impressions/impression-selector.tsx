import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BevveTheme as theme } from '@/constants/theme';
import { useTranslation } from '@/localization/language-provider';
import type { PlainTranslationKey } from '@/localization/translation';
import { impressionValues, type Impression } from './impression-state';

export const impressionLabels: Record<Impression, PlainTranslationKey> = {
  liked: 'I liked it', fine: 'It was fine', disliked: "I didn't like it",
};

// Semantic impression colors supplement the ivory/blue theme with symbols and
// a selected badge.
const choices: Record<Impression, { color: string; symbol: string }> = {
  liked: { color: '#82b79e', symbol: '✓' },
  fine: { color: '#d6b967', symbol: '−' },
  disliked: { color: '#d493a4', symbol: '×' },
};

export function ImpressionSelector({ value, onChange, disabled = false }: {
  value: Impression | null; onChange: (impression: Impression) => void; disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('How was it?')} style={styles.options}>
      {impressionValues.map((impression) => (
        <Pressable key={impression} accessibilityRole="radio" accessibilityLabel={t(impressionLabels[impression])}
          accessibilityState={{ checked: value === impression, disabled }} disabled={disabled}
          onPress={() => { if (!disabled) onChange(impression); }}
          style={({ pressed }) => [styles.option, disabled && styles.disabled, pressed && !disabled && styles.pressed]}>
          <View accessible={false} style={[styles.circle, { backgroundColor: choices[impression].color }, value === impression && styles.selected]}>
            <Text accessible={false} allowFontScaling={false} style={styles.symbol}>{choices[impression].symbol}</Text>
            {value === impression && <View accessible={false} style={styles.selectedBadge}>
              <Text accessible={false} allowFontScaling={false} style={styles.selectedSymbol}>✓</Text>
            </View>}
          </View>
          <Text allowFontScaling style={styles.label}>{t(impressionLabels[impression])}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  options: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm },
  option: { flex: 1, minWidth: 0, minHeight: 44, alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.xs },
  circle: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radii.pill, borderWidth: 3, borderColor: theme.colors.transparent },
  selected: { borderColor: theme.colors.text },
  symbol: { color: theme.colors.background, fontSize: 26, fontFamily: theme.fonts.bodyBold },
  selectedBadge: { position: 'absolute', top: -3, right: -3, width: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radii.pill, backgroundColor: theme.colors.text },
  selectedSymbol: { color: theme.colors.background, fontFamily: theme.fonts.bodyBold, fontSize: 12 },
  // Equal-width columns and unconstrained text height share one layout across
  // languages. Labels wrap and scale naturally; the surrounding modal scrolls.
  label: { width: '100%', flexShrink: 1, textAlign: 'center', color: theme.colors.text, fontFamily: theme.fonts.bodyBold, fontSize: 12, lineHeight: 18 },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.8 },
});

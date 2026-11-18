import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BevveTheme as theme } from '@/constants/theme';
import { useTranslation } from '@/localization/language-provider';
import type { PlainTranslationKey } from '@/localization/translation';
import { sentimentValues, type Sentiment } from './sentiment-state';

export const sentimentLabels: Record<Sentiment, PlainTranslationKey> = {
  liked: 'I liked it', fine: 'It was fine', disliked: "I didn't like it",
};

export function SentimentSelector({ value, onChange, disabled = false }: {
  value: Sentiment | null; onChange: (sentiment: Sentiment) => void; disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('How was it?')} style={styles.options}>
      {sentimentValues.map((sentiment) => (
        <Pressable key={sentiment} accessibilityRole="radio" accessibilityLabel={t(sentimentLabels[sentiment])}
          accessibilityState={{ checked: value === sentiment, disabled }} disabled={disabled}
          onPress={() => onChange(sentiment)}
          style={({ pressed }) => [styles.option, value === sentiment && styles.selected, pressed && styles.pressed]}>
          <Text style={styles.label}>{t(sentimentLabels[sentiment])}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  options: { gap: theme.spacing.sm },
  option: { minHeight: 48, justifyContent: 'center', padding: theme.spacing.md, borderRadius: theme.radii.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceRaised },
  selected: { borderColor: theme.colors.purpleLight, backgroundColor: theme.colors.purpleTint },
  label: { color: theme.colors.text, fontFamily: theme.fonts.bodyBold, fontSize: 14 },
  pressed: { opacity: 0.8 },
});

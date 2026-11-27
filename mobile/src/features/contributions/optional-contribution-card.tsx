import { useContext, useState, type PropsWithChildren } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AppIcon, type AppIconName } from '@/components/app-icon';
import { BevveTheme as theme } from '@/constants/theme';
import { ratingOverlayStyles as styles } from '@/features/ratings/rating-overlay-styles';
import { useTranslation } from '@/localization/language-provider';
import type { PlainTranslationKey } from '@/localization/translation';
import { ContributionBatchContext } from './contribution-batch';

export function OptionalContributionCard({ titleKey, hintKey, icon, disabled = false, children }: PropsWithChildren<{
  titleKey: PlainTranslationKey; hintKey: PlainTranslationKey; icon: AppIconName | 'euro'; disabled?: boolean;
}>) {
  const { t } = useTranslation();
  const batch = useContext(ContributionBatchContext);
  const [expanded, setExpanded] = useState(false);
  return <View style={[styles.optionalCard, expanded && styles.expandedCard]}>
    <Pressable accessibilityRole="button" accessibilityLabel={t(titleKey)} accessibilityState={{ expanded }} disabled={disabled || batch?.saving}
      onPress={() => setExpanded(value => !value)} style={({ pressed }) => [styles.cardSummary, pressed && styles.pressed]}>
      <View style={styles.cardIcon}>
        {icon === 'euro' ? <Text style={styles.euro} accessible={false}>€</Text> : <AppIcon name={icon} size={20} color={theme.colors.purpleLight} />}
      </View>
      <View style={styles.cardCopy}><Text style={styles.cardTitle}>{t(titleKey)}</Text><Text style={styles.hint}>{t(hintKey)}</Text></View>
      <View style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}><AppIcon name="chevron" size={16} color={theme.colors.purpleLight} /></View>
    </Pressable>
    <View accessibilityElementsHidden={!expanded} importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}
      style={[styles.placeholder, !expanded && { display: 'none' }]}>{children}</View>
  </View>;
}

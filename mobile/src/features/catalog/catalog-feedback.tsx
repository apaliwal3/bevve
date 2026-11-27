import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/primary-button';
import { BevveTheme as theme } from '@/constants/theme';
import { useTranslation } from '@/localization/language-provider';
import type { AccountCatalogValue } from './catalog-provider';

export function CatalogFeedback({ catalog }: { catalog: AccountCatalogValue }) {
  const { t } = useTranslation();
  if (!catalog.error && catalog.status === 'ready') return null;
  return <View style={styles.box}>
    <Text accessibilityRole={catalog.error ? 'alert' : undefined} accessibilityLiveRegion="polite" style={styles.text}>
      {catalog.error ? catalog.status === 'ready' ? t('Could not refresh. Showing the last loaded data.') : t('Venues and impressions could not be loaded.') : t('Loading venues and impressions…')}
    </Text>
    {catalog.error && <PrimaryButton label={t('Try again')} disabled={catalog.refreshing} onPress={() => { void catalog.refresh(); }} />}
  </View>;
}
const styles = StyleSheet.create({
  box: { padding: theme.spacing.lg, gap: theme.spacing.md },
  text: { color: theme.colors.textMuted, fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 20 },
});

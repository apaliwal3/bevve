import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { BevveTheme as theme } from '@/constants/theme';
import { ProfileSecondaryScreen } from '@/features/profile/profile-secondary-screen';
import { useTranslation } from '@/localization/language-provider';
import { useVenueCatalog, type AccountCatalogValue } from '@/features/catalog/catalog-provider';
import { AccountLanguageHistory, AccountLanguageModeration } from '@/features/contributions/account-language-panel';
import { AccountIncidentHistory, AccountIncidentModeration } from '@/features/contributions/account-safety-panel';
import { venueFromSettingsHref } from '@/features/venues/bar-details-navigation';

export default function SettingsRoute() {
  const { t } = useTranslation();
  const catalog = useVenueCatalog();
  return <ProfileSecondaryScreen title={t('Settings')}>
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.title}>{t('App language')}</Text>
      <Text style={styles.text}>{t('English')}</Text>
    </View>
    {catalog.mode === 'account' && <AccountTools catalog={catalog} />}
  </ProfileSecondaryScreen>;
}
// Existing private history and moderator tools remain reachable outside the feed.
function AccountTools({ catalog }: { catalog: AccountCatalogValue }) {
  const { t } = useTranslation();
  return <View style={styles.tools}>
    <Text accessibilityRole="header" style={styles.title}>{t('Account tools')}</Text>
    <AccountLanguageHistory catalog={catalog} onOpenVenue={id => router.push(venueFromSettingsHref(id))} />
    <AccountLanguageModeration catalog={catalog} />
    <AccountIncidentHistory catalog={catalog} />
    <AccountIncidentModeration catalog={catalog} />
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: 20, gap: 16, borderRadius: theme.radii.card, backgroundColor: theme.colors.surface },
  title: { color: theme.colors.text, fontFamily: theme.fonts.heading, fontSize: 18 },
  text: { color: theme.colors.text, fontFamily: theme.fonts.bodyBold, fontSize: 14, textAlign: 'center' },
  tools: { gap: 20 },
});

import { useState, type PropsWithChildren } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon, type AppIconName } from '@/components/app-icon';
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
    {catalog.mode === 'account' ? <AccountTools key={catalog.userId} catalog={catalog} />
      : <Text style={styles.note}>{t('Sign in to view your account tools.')}</Text>}
  </ProfileSecondaryScreen>;
}
// Reuse the owner histories and role-gated moderation tools, outside public activity.
// Only disclosure state is local; records, statuses and drafts stay in their providers.
function AccountTools({ catalog }: { catalog: AccountCatalogValue }) {
  const { t } = useTranslation();
  return <View style={styles.tools}>
    <SettingsSection label={t('My language suggestions')} icon="languages">
      <AccountLanguageHistory catalog={catalog} onOpenVenue={id => router.push(venueFromSettingsHref(id))} />
      <AccountLanguageModeration catalog={catalog} />
    </SettingsSection>
    <SettingsSection label={t('My private incident reports')} icon="safety">
      <AccountIncidentHistory catalog={catalog} />
      <AccountIncidentModeration catalog={catalog} />
    </SettingsSection>
  </View>;
}

function SettingsSection({ label, icon, children }: PropsWithChildren<{ label: string; icon: AppIconName }>) {
  const [expanded, setExpanded] = useState(false);
  return <View style={styles.section}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded }}
      onPress={() => setExpanded(value => !value)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <AppIcon name={icon} color={theme.colors.purpleLight} />
      <Text style={styles.label}>{label}</Text>
      <View style={expanded ? styles.expanded : undefined}><AppIcon name="chevron" color={theme.colors.purpleLight} /></View>
    </Pressable>
    {expanded && <View style={styles.details}>{children}</View>}
  </View>;
}

const styles = StyleSheet.create({
  tools: { gap: 12 },
  section: { borderRadius: theme.radii.card, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  label: { flex: 1, minWidth: 0, color: theme.colors.text, fontFamily: theme.fonts.bodyBold, fontSize: 15 },
  details: { padding: 16, paddingTop: 4, gap: 20 },
  note: { color: theme.colors.textSecondary, fontFamily: theme.fonts.body, fontSize: 14, lineHeight: 22 },
  expanded: { transform: [{ rotate: '90deg' }] },
  pressed: { opacity: 0.75 },
});

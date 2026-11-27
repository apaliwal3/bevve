import { useRef, useState, type PropsWithChildren } from 'react';
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
import { useAuth } from '@/features/auth/auth-provider';
import { authErrorMessage } from '@/features/auth/auth-store';
import { exitProfile } from '@/features/profile/profile-identity';
import { profileDestinations } from '@/features/profile/profile-navigation';

export default function SettingsRoute() {
  const { t } = useTranslation();
  const catalog = useVenueCatalog();
  return <ProfileSecondaryScreen title={t('Settings')}>
    <View style={styles.tools}>
      <Text accessibilityRole="header" style={styles.groupTitle}>{t('Account')}</Text>
      <AccountActions key={catalog.mode === 'account' ? catalog.userId : 'demo'} />
    </View>
    <View style={styles.tools}>
      <Text accessibilityRole="header" style={styles.groupTitle}>{t('Contributions')}</Text>
      {catalog.mode === 'account' ? <AccountTools key={catalog.userId} catalog={catalog} />
        : <Text style={styles.note}>{t('Sign in to view your account tools.')}</Text>}
    </View>
  </ProfileSecondaryScreen>;
}

function AccountActions() {
  const { t } = useTranslation();
  const auth = useAuth();
  const pending = useRef(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<ReturnType<typeof authErrorMessage> | null>(null);
  async function leave() {
    if (pending.current) return;
    pending.current = true;
    setSigningOut(true);
    setError(null);
    try { await exitProfile(auth.session, auth.signOut, () => router.dismissTo('/')); }
    catch (error) { setError(authErrorMessage(error)); }
    finally { pending.current = false; setSigningOut(false); }
  }
  return <View style={styles.tools}>
    <View style={styles.section}>
      <SettingsRow label={t('Change Password')} icon="password" onPress={() => router.push(profileDestinations.password)} />
      <View style={styles.divider} />
      <SettingsRow label={signingOut ? t('Please wait…') : auth.session ? t('Log Out') : t('Return to Welcome')} icon="logout"
        disabled={signingOut} busy={signingOut} onPress={() => { void leave(); }} />
    </View>
    {error && <Text accessibilityRole="alert" style={styles.note}>{t(error)}</Text>}
  </View>;
}
// Reuse the owner histories and role-gated moderation tools, outside public activity.
// Only disclosure state is local; records, statuses and drafts stay in their providers.
function AccountTools({ catalog }: { catalog: AccountCatalogValue }) {
  const { t } = useTranslation();
  return <View style={styles.tools}>
    <SettingsSection label={t('My language suggestions')} icon="languages">
      <AccountLanguageHistory embedded catalog={catalog} onOpenVenue={id => router.push(venueFromSettingsHref(id))} />
      <AccountLanguageModeration embedded catalog={catalog} />
    </SettingsSection>
    <SettingsSection label={t('My private incident reports')} icon="safety">
      <AccountIncidentHistory embedded catalog={catalog} />
      <AccountIncidentModeration embedded catalog={catalog} />
    </SettingsSection>
  </View>;
}

function SettingsSection({ label, icon, children }: PropsWithChildren<{ label: string; icon: AppIconName }>) {
  const [expanded, setExpanded] = useState(false);
  return <View style={styles.section}>
    <SettingsRow label={label} icon={icon} expanded={expanded} onPress={() => setExpanded(value => !value)} />
    {expanded && <View style={styles.details}>{children}</View>}
  </View>;
}

function SettingsRow({ label, icon, expanded, disabled = false, busy = false, onPress }: {
  label: string; icon: AppIconName; expanded?: boolean; disabled?: boolean; busy?: boolean; onPress: () => void;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded, disabled, busy }} disabled={disabled}
      onPress={onPress} style={({ pressed }) => [styles.row, (pressed || disabled) && styles.pressed]}>
      <AppIcon name={icon} color={theme.colors.purpleLight} />
      <Text style={styles.label}>{label}</Text>
      <View style={expanded ? styles.expanded : undefined}><AppIcon name="chevron" color={theme.colors.purpleLight} /></View>
    </Pressable>;
}

const styles = StyleSheet.create({
  tools: { gap: 12 },
  groupTitle: { color: theme.colors.textMuted, fontFamily: theme.fonts.bodyBold, fontSize: 13 },
  section: { borderRadius: theme.radii.card, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  label: { flex: 1, minWidth: 0, color: theme.colors.text, fontFamily: theme.fonts.bodyBold, fontSize: 15 },
  details: { padding: 16, paddingTop: 4, gap: 20 },
  divider: { marginHorizontal: 16, height: 1, backgroundColor: theme.colors.border },
  note: { color: theme.colors.textSecondary, fontFamily: theme.fonts.body, fontSize: 14, lineHeight: 22 },
  expanded: { transform: [{ rotate: '90deg' }] },
  pressed: { opacity: 0.75 },
});

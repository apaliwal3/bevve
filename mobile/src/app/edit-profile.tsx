import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/primary-button';
import { BevveTheme as theme } from '@/constants/theme';
import { useTranslation } from '@/localization/language-provider';
import { ProfileSecondaryScreen } from '@/features/profile/profile-secondary-screen';
import { useProfileIdentity } from '@/features/profile/use-profile-identity';

// The full identity-edit contract does not exist. A read-only preview avoids a
// competing local profile store or a fake save to Supabase/auth metadata.
export default function EditProfileRoute() {
  const { t } = useTranslation();
  const identity = useProfileIdentity();
  return <ProfileSecondaryScreen title={t('Edit Profile')}>
    <Text style={styles.note}>{identity.demo ? t('Demo profile preview. Profile editing is not available and no changes are saved.')
      : t('Profile editing is not available yet. Your current account details are shown below.')}</Text>
    <View style={styles.card}>
      <Field label={t('First name')} value={t('Not available yet')} />
      <Field label={t('Surname')} value={t('Not available yet')} />
      <Field label={t('Username')} value={identity.demo ? '@demo' : identity.loading ? t('Please wait…') : identity.username ? '@' + identity.username : t('Username unavailable')} />
      <Field label={t('Profile picture')} value={t('Initials only')} />
    </View>
    {identity.error && <>
      <Text accessibilityRole="alert" style={styles.note}>{t('Your profile could not be loaded.')}</Text>
      <PrimaryButton label={t('Try again')} variant="secondary" onPress={identity.retry} />
    </>}
    <Text style={styles.note}>{t('Names and photo uploads are not supported by the current profile service.')}</Text>
  </ProfileSecondaryScreen>;
}
function Field({ label, value }: { label: string; value: string }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>;
}
const styles = StyleSheet.create({
  card: { padding: 20, borderRadius: theme.radii.card, backgroundColor: theme.colors.surface, gap: 24 },
  field: { gap: 6 }, label: { fontFamily: theme.fonts.bodyBold, fontSize: 13, color: theme.colors.textMuted },
  value: { fontFamily: theme.fonts.body, fontSize: 16, color: theme.colors.text },
  note: { fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.textSecondary },
});

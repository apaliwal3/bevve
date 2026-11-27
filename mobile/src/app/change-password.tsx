import { StyleSheet, Text, View } from 'react-native';
import { BevveTheme as theme } from '@/constants/theme';
import { ProfileSecondaryScreen } from '@/features/profile/profile-secondary-screen';
import { useTranslation } from '@/localization/language-provider';

// Password updates are not connected. Keep this screen informational: no inputs,
// credential state, persistence, or auth requests until that flow is supported.
export default function ChangePasswordRoute() {
  const { t } = useTranslation();
  return <ProfileSecondaryScreen title={t('Change Password')}>
    <View style={styles.card}>
      <Text style={styles.note}>{t('Password changes are not available in the app yet.')}</Text>
    </View>
  </ProfileSecondaryScreen>;
}

const styles = StyleSheet.create({
  card: { padding: 20, borderRadius: theme.radii.card, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  note: { fontFamily: theme.fonts.body, fontSize: 16, lineHeight: 24, color: theme.colors.textSecondary },
});

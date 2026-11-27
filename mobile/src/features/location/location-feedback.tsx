import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/primary-button';
import { BevveTheme as theme } from '@/constants/theme';
import { useTranslation } from '@/localization/language-provider';
import type { PlainTranslationKey } from '@/localization/translation';
import { useAccountLocation } from './account-location-provider';

export function LocationFeedback() {
  const location = useAccountLocation(), { t } = useTranslation();
  let message: PlainTranslationKey;
  if (location.status === 'denied') message = location.canAskAgain ? 'Location access was denied. Allow location to show distances and use Nearby.' : 'Location access is blocked. Allow it in settings, then return here.';
  else if (location.status === 'services-off') message = 'Turn on device location services, then retry.';
  else if (location.status === 'unavailable' && location.issue === 'accuracy') message = 'A more precise location is needed to show distances. Enable precise location in settings, then retry.';
  else return null;
  const settings = location.status === 'denied' && !location.canAskAgain || location.issue === 'accuracy';
  return <View style={styles.section}>
    <Text accessibilityRole={['denied','services-off','unavailable'].includes(location.status) ? 'alert' : undefined}
      accessibilityLiveRegion="polite" style={styles.note}>{t(message)}</Text>
    {location.settingsError && <Text accessibilityRole="alert" style={styles.note}>{t('Open your device or browser settings to allow location, then retry.')}</Text>}
    {settings && <PrimaryButton label={t('Open location settings')} variant="secondary" onPress={() => { void location.openSettings(); }} />}
    {!settings && <PrimaryButton label={t('Use my location')}
      variant="secondary" onPress={() => { void location.enable(); }} />}
  </View>;
}
const styles = StyleSheet.create({ section: { gap: theme.spacing.sm }, note: { color: theme.colors.textMuted, fontFamily: theme.fonts.body, fontSize: 12, lineHeight: 19 } });

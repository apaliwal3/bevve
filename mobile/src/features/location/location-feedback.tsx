import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/primary-button';
import { BevveTheme as theme } from '@/constants/theme';
import { useTranslation } from '@/localization/language-provider';
import type { PlainTranslationKey } from '@/localization/translation';
import { useAccountLocation } from './account-location-provider';

export function LocationFeedback({ onDisable, nearby }: { onDisable: () => void; nearby: boolean }) {
  const location = useAccountLocation(), { t, format } = useTranslation();
  const busy = location.status === 'checking' || location.status === 'locating';
  let message: PlainTranslationKey = 'Use your location to find real venues within 1 km.';
  if (location.status === 'checking') message = 'Checking location access…';
  if (location.status === 'locating') message = 'Finding your current location…';
  if (location.status === 'denied') message = location.canAskAgain ? 'Location access was denied. Allow location to use Nearby.' : 'Location access is blocked. Allow it in settings, then return here.';
  if (location.status === 'services-off') message = 'Turn on device location services, then retry.';
  if (location.status === 'unavailable') message = location.issue === 'accuracy'
    ? 'A more precise location is needed for Nearby. Enable precise location in settings, then retry.'
    : location.issue === 'stale' ? 'Your location is out of date. Refresh it to use Nearby.'
      : location.issue === 'timeout' ? 'Finding your location took too long. Try again outdoors or near a window.' : 'Your current location is unavailable. Please retry.';
  const settings = location.status === 'denied' && !location.canAskAgain || location.issue === 'accuracy';
  return <View style={styles.section}>
    <Text accessibilityRole={['denied','services-off','unavailable'].includes(location.status) ? 'alert' : undefined}
      accessibilityLiveRegion="polite" style={styles.note}>{location.status === 'ready' && location.fix
        ? nearby ? t('Within 1 km · Closest first · Straight-line estimates. Location accuracy: about {distance} m.', { distance: format.number(Math.round(location.fix.accuracy)) })
          : t('Distances are straight-line estimates. Location accuracy: about {distance} m.', { distance: format.number(Math.round(location.fix.accuracy)) }) : t(message)}</Text>
    <Text style={styles.note}>{t('Your location stays on this device for this session. Sample venues have no real distances.')}</Text>
    {location.settingsError && <Text accessibilityRole="alert" style={styles.note}>{t('Open your device or browser settings to allow location, then retry.')}</Text>}
    {settings && <PrimaryButton label={t('Open location settings')} variant="secondary" onPress={() => { void location.openSettings(); }} />}
    <PrimaryButton label={busy ? t('Please wait…') : location.status === 'ready' ? t('Refresh location') : t('Use my location')}
      variant="secondary" disabled={busy} onPress={() => { void (location.status === 'ready' ? location.refresh() : location.enable()); }} />
    {location.enabled && <PrimaryButton label={t('Stop using location')} variant="secondary" onPress={onDisable} />}
  </View>;
}
const styles = StyleSheet.create({ section: { gap: theme.spacing.sm }, note: { color: theme.colors.textMuted, fontFamily: theme.fonts.body, fontSize: 12, lineHeight: 19 } });
